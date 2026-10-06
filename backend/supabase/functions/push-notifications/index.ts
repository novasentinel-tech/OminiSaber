import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type JsonRecord = Record<string, unknown>;

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const originAllowed = (origin: string) =>
  !origin ||
  allowedOrigins.length === 0 ||
  allowedOrigins.some((allowed) =>
    allowed.includes("*")
      ? new RegExp(`^${allowed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace("*", ".*")}$`).test(origin)
      : allowed === origin,
  );

const corsHeaders = (request: Request) => {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": originAllowed(origin) ? origin || "*" : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

const response = (request: Request, body: JsonRecord, status = 200) =>
  Response.json(body, {
    status,
    headers: { ...corsHeaders(request), "Cache-Control": "no-store" },
  });

const bearerToken = (request: Request) =>
  (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

const requireEnvironment = () => {
  const values = {
    url: Deno.env.get("SUPABASE_URL"),
    anon: Deno.env.get("SUPABASE_ANON_KEY"),
    service: Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    vapidPublic: Deno.env.get("VAPID_PUBLIC_KEY"),
    vapidPrivate: Deno.env.get("VAPID_PRIVATE_KEY"),
    vapidSubject: Deno.env.get("VAPID_SUBJECT") || "mailto:suporte@ominisaber.app",
    webhookSecret: Deno.env.get("PUSH_WEBHOOK_SECRET"),
  };
  const missing = Object.entries(values)
    .filter(([key, value]) => !value && key !== "webhookSecret")
    .map(([key]) => key);
  if (missing.length) throw new Error(`Configuração ausente: ${missing.join(", ")}`);
  return values as Record<keyof typeof values, string>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return response(request, { error: "Método não permitido." }, 405);
  if (!originAllowed(request.headers.get("origin") || ""))
    return response(request, { error: "Origem não autorizada." }, 403);

  try {
    const env = requireEnvironment();
    const admin = createClient(env.url, env.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = (await request.json()) as JsonRecord;
    const action = String(body.action || "");
    const token = bearerToken(request);
    const isService = token === env.service;
    const isWebhook = Boolean(
      env.webhookSecret && request.headers.get("x-push-secret") === env.webhookSecret,
    );

    let userId = "";
    if (!isService && !isWebhook) {
      if (!token) return response(request, { error: "Sessão obrigatória." }, 401);
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return response(request, { error: "Sessão inválida." }, 401);
      userId = data.user.id;
    }

    if (action === "public_key")
      return response(request, { publicKey: env.vapidPublic });

    if (action === "subscribe") {
      const subscription = body.subscription as JsonRecord | undefined;
      const keys = subscription?.keys as JsonRecord | undefined;
      const endpoint = String(subscription?.endpoint || "");
      const p256dh = String(keys?.p256dh || "");
      const auth = String(keys?.auth || "");
      if (!endpoint || !p256dh || !auth)
        return response(request, { error: "Inscrição de dispositivo inválida." }, 400);
      const { error } = await admin.from("push_dispositivos").upsert(
        {
          usuario_id: userId,
          endpoint,
          chave_p256dh: p256dh,
          chave_auth: auth,
          nome_dispositivo: String(body.deviceName || "Navegador").slice(0, 120),
          user_agent: String(request.headers.get("user-agent") || "").slice(0, 500),
          ativo: true,
          ultimo_uso_em: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      return response(request, { subscribed: true });
    }

    if (action === "unsubscribe") {
      const endpoint = String(body.endpoint || "");
      const { error } = await admin
        .from("push_dispositivos")
        .update({ ativo: false, ultimo_uso_em: new Date().toISOString() })
        .eq("usuario_id", userId)
        .eq("endpoint", endpoint);
      if (error) throw error;
      return response(request, { subscribed: false });
    }

    if (action === "status") {
      const endpoint = String(body.endpoint || "");
      const { data, error } = await admin
        .from("push_dispositivos")
        .select("id,ativo,nome_dispositivo,ultimo_uso_em")
        .eq("usuario_id", userId)
        .eq("endpoint", endpoint)
        .maybeSingle();
      if (error) throw error;
      return response(request, { subscribed: Boolean(data?.ativo), device: data || null });
    }

    let notificationId = String(body.notificationId || "");
    const webhookRecord = body.record as JsonRecord | undefined;
    if (!notificationId && webhookRecord?.notificacao_id)
      notificationId = String(webhookRecord.notificacao_id);

    if (action === "dispatch_event") {
      const eventId = String(body.eventId || "");
      if (!eventId) return response(request, { error: "Compromisso não informado." }, 400);
      const scoped = createClient(env.url, env.anon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: event, error: eventError } = await scoped
        .from("eventos_agenda")
        .select("id,status")
        .eq("id", eventId)
        .maybeSingle();
      if (eventError || !event || event.status !== "publicado")
        return response(request, { error: "Compromisso indisponível para disparo." }, 403);
      const { data: notification, error: notificationError } = await admin
        .from("notificacoes")
        .select("id")
        .eq("evento_agenda_id", eventId)
        .maybeSingle();
      if (notificationError || !notification)
        return response(request, { error: "Aviso do compromisso ainda não foi criado." }, 409);
      notificationId = notification.id;
    } else if (!isService && !isWebhook) {
      return response(request, { error: "Ação não autorizada." }, 403);
    }

    if (!notificationId)
      return response(request, { error: "Notificação não informada." }, 400);

    const { data: notification, error: notificationError } = await admin
      .from("notificacoes")
      .select("id,titulo,mensagem,prioridade,destino_turma_id,destino_usuario_id,evento_agenda_id")
      .eq("id", notificationId)
      .single();
    if (notificationError) throw notificationError;

    let recipientIds: string[] = [];
    if (notification.destino_usuario_id) {
      recipientIds = [notification.destino_usuario_id];
    } else if (notification.destino_turma_id) {
      const { data: students, error: studentsError } = await admin
        .from("perfis")
        .select("id")
        .eq("role", "aluno")
        .eq("turma_id", notification.destino_turma_id)
        .neq("ativo", false);
      if (studentsError) throw studentsError;
      recipientIds = (students || []).map((student) => student.id);
    }

    if (!recipientIds.length)
      return response(request, { delivered: 0, skipped: 0, recipients: 0 });

    const { data: devices, error: devicesError } = await admin
      .from("push_dispositivos")
      .select("id,usuario_id,endpoint,chave_p256dh,chave_auth")
      .in("usuario_id", recipientIds)
      .eq("ativo", true);
    if (devicesError) throw devicesError;

    await admin
      .from("push_fila")
      .update({ status: "processando", tentativas: 1, ultimo_erro: null })
      .eq("notificacao_id", notificationId);

    webpush.setVapidDetails(env.vapidSubject, env.vapidPublic, env.vapidPrivate);
    const payload = JSON.stringify({
      title: notification.titulo,
      body: notification.mensagem,
      tag: `ominisaber-${notification.id}`,
      renotify: notification.prioridade === "alta",
      url: notification.evento_agenda_id
        ? `/frontend/aluno/agenda/index.html?evento=${notification.evento_agenda_id}`
        : "/frontend/aluno/notificacoes/index.html",
      notificationId: notification.id,
    });

    let delivered = 0;
    let failed = 0;
    let skipped = 0;
    for (const device of devices || []) {
      const { data: delivery, error: claimError } = await admin
        .from("push_entregas")
        .insert({
          notificacao_id: notificationId,
          usuario_id: device.usuario_id,
          dispositivo_id: device.id,
          status: "processando",
        })
        .select("id")
        .maybeSingle();
      if (claimError?.code === "23505") {
        skipped += 1;
        continue;
      }
      if (claimError || !delivery) throw claimError || new Error("Falha ao reservar entrega.");

      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.chave_p256dh, auth: device.chave_auth },
          },
          payload,
          { TTL: 604800, urgency: notification.prioridade === "alta" ? "high" : "normal" },
        );
        delivered += 1;
        await admin
          .from("push_entregas")
          .update({ status: "enviado", enviada_em: new Date().toISOString(), ultimo_erro: null })
          .eq("id", delivery.id);
      } catch (error) {
        failed += 1;
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0) || null;
        const expired = statusCode === 404 || statusCode === 410;
        await admin
          .from("push_entregas")
          .update({
            status: expired ? "expirado" : "falhou",
            codigo_http: statusCode,
            ultimo_erro: String(error instanceof Error ? error.message : error).slice(0, 500),
          })
          .eq("id", delivery.id);
        if (expired)
          await admin.from("push_dispositivos").update({ ativo: false }).eq("id", device.id);
      }
    }

    const queueStatus = failed === 0 ? "concluido" : delivered > 0 ? "parcial" : "falhou";
    await admin
      .from("push_fila")
      .update({
        status: queueStatus,
        processada_em: new Date().toISOString(),
        ultimo_erro: failed ? `${failed} dispositivo(s) não receberam o push.` : null,
      })
      .eq("notificacao_id", notificationId);

    return response(request, {
      delivered,
      failed,
      skipped,
      recipients: recipientIds.length,
      devices: (devices || []).length,
    });
  } catch (error) {
    console.error("[OminiSaber][push-notifications]", error);
    return response(
      request,
      { error: error instanceof Error ? error.message : "Falha interna no disparo." },
      500,
    );
  }
});
