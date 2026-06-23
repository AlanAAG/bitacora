export const Copy = {
  // App
  appName: 'Bitácora',
  tagline: 'Tu auto. Tu dinero. Siempre protegidos.',

  // Onboarding
  ob1Question: '¿Alguna vez saliste del taller sin saber si te cobraron de más?',
  ob1Yes: 'Sí, me ha pasado',
  ob1No: 'No, siempre verifico',
  ob2Headline: 'Bitácora te protege.',
  ob2Body: 'Guarda el historial de tu auto, recibe recordatorios inteligentes y usa el Modo Guardia para saber si tu mecánico es honesto.',
  ob3Headline: 'Agrega tu primer auto',
  ob3Sub: 'Tarda menos de 2 minutos.',

  // Car setup
  addCar: 'Agregar auto',
  brand: 'Marca',
  model: 'Modelo',
  year: 'Año',
  plates: 'Placas',
  mileage: 'Kilometraje actual',
  nickname: 'Apodo (opcional)',
  hologram: 'Tipo de holograma',

  // Home
  myCarTab: 'Mi Auto',
  healthScore: 'Salud del auto',
  upcomingReminders: 'Próximos recordatorios',
  noReminders: 'Todo en orden. Sin recordatorios pendientes. ✓',

  // Service log
  serviceLog: 'Servicios',
  addService: 'Registrar servicio',
  noServices: 'Sin servicios registrados. Agrega el primero.',

  // Reminders (Approach framing — car-personalized)
  reminderOilTemplate: (brand: string, km: number) => `Tu ${brand} tiene cambio de aceite en ${km.toLocaleString('es-MX')} km`,
  reminderDocTemplate: (doc: string, days: number) => `Protege tu familia: ${doc} vence en ${days} días`,
  reminderVerifTemplate: (brand: string, date: string) => `Verificación de tu ${brand}: empieza el ${date}`,

  // Guard
  guardTab: 'Guardia',
  guardHeadline: 'Modo Guardia',
  guardSub: 'Pon el teléfono boca arriba en el taller. La IA escucha y te avisa después.',
  guardConsent: 'Bitácora grabará el audio de la visita para analizarlo. El audio se elimina al terminar — solo guardamos el resultado. En México, grabar una conversación en la que participas es legal.',
  guardConsentAccept: 'Entendido, activar Guardia',
  guardConsentDecline: 'Cancelar',
  guardRecording: 'Guardando conversación...',
  guardRecordingSub: 'Mantén el teléfono sin bloquear. Puedes poner la pantalla hacia abajo.',
  guardStop: 'Terminar y analizar',
  guardAnalyzing: 'Analizando con IA...',
  guardResultHonest: 'Mecánico honesto ✓',
  guardResultWarning: 'Alertas encontradas',
  guardResultDanger: 'Señales de alerta graves',
  guardSavedPrefix: 'Esta sesión potencialmente te ahorró',
  guardShareCta: 'Compartir resultado',
  guardNewSession: 'Nueva sesión',

  // Paywall
  paywallHeadline: '¿Cuánto te cuesta un mecánico deshonesto?',
  paywallSub: 'El promedio en México: $1,200 MXN por visita. Bitácora Pro cuesta $149 MXN al mes.',
  paywallMath: 'Una sesión de Guardia que detecte un cobro de más te paga 8 meses de suscripción.',
  paywallCta: 'Activar Pro + Guardia',
  paywallFreeCta: 'Continuar gratis (3 sesiones/mes)',

  // Referral
  referralHeadline: 'Invita a alguien y ambos ganan',
  referralBody: 'Comparte tu link. Cuando se registren, tú y tu amigo reciben 5 sesiones de Guardia gratis.',
  referralShareText: (code: string) =>
    `¿Tu mecánico es honesto? Yo uso Bitácora para verificarlo. Pruébalo gratis: https://bitacora.app/r/${code}`,
} as const;
