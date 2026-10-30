let routed = {};
try {
  routed = $('Roteador da conversa').first().json || {};
} catch (error) {
  routed = {};
}
if (!routed.phone) return [];
return [
  {
    json: {
      whatsappBody: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: routed.phone,
        type: 'text',
        text: {
          preview_url: false,
          body: 'Não consegui consultar a agenda agora. Tente de novo em alguns minutos.\n\nSe você estava confirmando, responda CONFIRMAR. Ou responda MENU.',
        },
      },
    },
  },
];
