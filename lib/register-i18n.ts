// Translations for the visitor sign-in form (/register/[id]) — the one page
// of the product the general public uses. English, Spanish, Vietnamese,
// Chinese (Simplified), Korean, and Hindi.
//
// Rules of the road:
// - DISPLAY ONLY. Values submitted to the API stay English — the purchasing
//   timeline posts TIMELINE_VALUES[i], never the translated label, so
//   dashboards/reports/CRM parsing are untouched.
// - STOP and HELP stay in English inside every consent text: they are the
//   literal SMS keywords Twilio recognizes, not prose.
// - Every non-English consent adds "the English version governs" in that
//   language, since /terms and /privacy remain English.
// - The RegisterStrings interface makes TypeScript fail the build if any
//   language is missing a string.

export type Lang = 'en' | 'es' | 'vi' | 'zh' | 'ko' | 'hi'

export const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
]

// Submitted to the API / stored in visitors.purchasing_timeline — never
// translated (lib/timeline ranks on these exact strings).
export const TIMELINE_VALUES = ['0–3 Months', '3–6 Months', '6–12 Months', '12+ Months'] as const

// Stored in visitors.feedback_price — never translated. The three price buttons
// display feedbackPrices[i] but submit FEEDBACK_PRICE_VALUES[i], so aggregation
// and the DB CHECK constraint stay on these exact English strings.
export const FEEDBACK_PRICE_VALUES = ['Too High', 'Reasonable', 'Too Low'] as const

export interface RegisterStrings {
  tagline: string
  loading: string
  firstName: string
  firstNamePlaceholder: string
  lastName: string
  lastNamePlaceholder: string
  email: string
  emailPlaceholder: string
  phone: string
  timeline: string
  timelines: [string, string, string, string]
  errName: string
  errEmail: string
  errPhone: string
  errTimeline: string
  errSubmit: string
  requestBtn: string
  requestBtnName: string
  submitting: string
  // Contains {button}; rendered with the bolded button name substituted in.
  consentSms: string
  agreePrefix: string
  termsLink: string
  agreeSuffix: string
  // Used instead of agreeSuffix when the host agent has an accepted sponsor
  // (3rd-party provider). Contains {sponsor}; rendered with the sponsor's
  // name (bolded) substituted in, so consent explicitly names them.
  agreeSuffixSponsored: string
  englishGoverns: string
  narTitle: string
  narBody: string
  thankYou: string
  sentBody1: string
  sentBody2: string
  checkPhone: string
  checkEmail: string
  checkAgent: string
  // Post-visit feedback card on the success screen. feedbackIntro contains
  // {after}; rendered with feedbackAfter bolded (Dave's "After your tour…").
  feedbackIntro: string
  feedbackAfter: string
  feedbackQ1: string
  feedbackQ2: string
  feedbackScaleLow: string
  feedbackScaleHigh: string
  // Display labels for the three price buttons; submitted values stay English
  // (FEEDBACK_PRICE_VALUES), like the timeline.
  feedbackPrices: [string, string, string]
  feedbackSubmit: string
  feedbackSubmitting: string
  feedbackThanks: string
  feedbackError: string
}

const en: RegisterStrings = {
  tagline: 'Secure open house registration',
  loading: 'Loading...',
  firstName: 'First Name',
  firstNamePlaceholder: 'First',
  lastName: 'Last Name',
  lastNamePlaceholder: 'Last',
  email: 'Valid Email Address',
  emailPlaceholder: 'you@email.com',
  phone: 'Valid Phone Number',
  timeline: 'Purchasing Timeline',
  timelines: ['0–3 Months', '3–6 Months', '6–12 Months', '12+ Months'],
  errName: 'Please enter your first and last name',
  errEmail: 'Please enter a valid email address',
  errPhone: 'Please enter a valid U.S. or Canadian phone number',
  errTimeline: 'Please select a purchasing timeline',
  errSubmit: 'Something went wrong. Please try again.',
  requestBtn: 'Request Access Code →',
  requestBtnName: 'Request Access Code',
  submitting: 'Sending your code...',
  consentSms: 'By entering your number and tapping {button}, you agree to receive a one-time SMS access code from ohACCESS to enter this open house. Message & data rates may apply. Reply STOP to opt out, HELP for help.',
  agreePrefix: 'You also agree to the ',
  termsLink: 'ohACCESS Terms of Service & Privacy Policy',
  agreeSuffix: ', and consent to be contacted by the host agent via phone, text, and email about this and other properties.',
  agreeSuffixSponsored: ", and consent to be contacted by the host agent and today's sponsor, {sponsor}, via phone, text, and email about this and other properties.",
  englishGoverns: '',
  narTitle: 'Prefer not to register?',
  narBody: "You're welcome to schedule a private showing of this — or any — listed property with the buyer's agent of your choice. Under NAR rules effective August 17, 2024, you'll need a written buyer representation agreement with that agent before they can show you the home; most agents can prepare one on the spot. ohACCESS registration is required only to attend today's open house.",
  thankYou: 'Thank you!',
  sentBody1: 'Your codeword was sent to your phone, with a backup codeword sent to your email.',
  sentBody2: 'At the door, share your codeword with the host to be granted access.',
  checkPhone: '✓ Codeword was sent to your phone.',
  checkEmail: '✓ Backup codeword was sent to your email.',
  checkAgent: '✓ Agent has been notified of your arrival.',
  feedbackIntro: '{after} your tour, please provide feedback to the following questions.',
  feedbackAfter: 'After',
  feedbackQ1: 'Considering the features, location, and condition of the home, how would you rate it overall?',
  feedbackQ2: 'Considering the features, location, and condition of the home, how do you feel about the price?',
  feedbackScaleLow: 'Poor',
  feedbackScaleHigh: 'Excellent',
  feedbackPrices: ['Too High', 'Reasonable', 'Too Low'],
  feedbackSubmit: 'Submit feedback',
  feedbackSubmitting: 'Sending…',
  feedbackThanks: 'Thank you! Your feedback was shared with the agent for the seller.',
  feedbackError: 'Could not save your feedback. Please try again.',
}

const es: RegisterStrings = {
  tagline: 'Registro seguro de casa abierta',
  loading: 'Cargando...',
  firstName: 'Nombre',
  firstNamePlaceholder: 'Nombre',
  lastName: 'Apellido',
  lastNamePlaceholder: 'Apellido',
  email: 'Correo electrónico válido',
  emailPlaceholder: 'tu@correo.com',
  phone: 'Número de teléfono válido',
  timeline: 'Plazo de compra',
  timelines: ['0–3 meses', '3–6 meses', '6–12 meses', 'Más de 12 meses'],
  errName: 'Por favor escribe tu nombre y apellido',
  errEmail: 'Por favor ingresa un correo electrónico válido',
  errPhone: 'Por favor ingresa un número de teléfono válido de EE. UU. o Canadá',
  errTimeline: 'Por favor selecciona un plazo de compra',
  errSubmit: 'Algo salió mal. Por favor intenta de nuevo.',
  requestBtn: 'Solicitar código de acceso →',
  requestBtnName: 'Solicitar código de acceso',
  submitting: 'Enviando tu código...',
  consentSms: 'Al ingresar tu número y tocar {button}, aceptas recibir un código de acceso de un solo uso por SMS de ohACCESS para entrar a esta casa abierta. Pueden aplicar tarifas de mensajes y datos. Responde STOP para cancelar, HELP para ayuda.',
  agreePrefix: 'También aceptas los ',
  termsLink: 'Términos de Servicio y Política de Privacidad de ohACCESS',
  agreeSuffix: ', y das tu consentimiento para que el agente anfitrión te contacte por teléfono, mensaje de texto y correo electrónico sobre esta y otras propiedades.',
  agreeSuffixSponsored: ', y das tu consentimiento para que el agente anfitrión y el patrocinador de hoy, {sponsor}, te contacten por teléfono, mensaje de texto y correo electrónico sobre esta y otras propiedades.',
  englishGoverns: 'En caso de discrepancia, la versión en inglés de los Términos prevalece.',
  narTitle: '¿Prefieres no registrarte?',
  narBody: 'Puedes programar una visita privada de esta —o cualquier— propiedad listada con el agente de compradores que elijas. Según las reglas de NAR vigentes desde el 17 de agosto de 2024, necesitarás un acuerdo escrito de representación de comprador con ese agente antes de que pueda mostrarte la casa; la mayoría de los agentes pueden prepararlo en el momento. El registro de ohACCESS solo se requiere para asistir a la casa abierta de hoy.',
  thankYou: '¡Gracias!',
  sentBody1: 'Tu palabra clave fue enviada a tu teléfono, con una palabra clave de respaldo enviada a tu correo.',
  sentBody2: 'En la puerta, comparte tu palabra clave con el anfitrión para obtener acceso.',
  checkPhone: '✓ Tu palabra clave fue enviada a tu teléfono.',
  checkEmail: '✓ La palabra clave de respaldo fue enviada a tu correo.',
  checkAgent: '✓ El agente ha sido notificado de tu llegada.',
  feedbackIntro: '{after} de tu recorrido, por favor responde las siguientes preguntas.',
  feedbackAfter: 'Después',
  feedbackQ1: 'Considerando las características, la ubicación y el estado de la casa, ¿cómo la calificarías en general?',
  feedbackQ2: 'Considerando las características, la ubicación y el estado de la casa, ¿qué opinas del precio?',
  feedbackScaleLow: 'Mala',
  feedbackScaleHigh: 'Excelente',
  feedbackPrices: ['Muy alto', 'Razonable', 'Muy bajo'],
  feedbackSubmit: 'Enviar comentarios',
  feedbackSubmitting: 'Enviando…',
  feedbackThanks: '¡Gracias! Tus comentarios se compartieron con el agente para el vendedor.',
  feedbackError: 'No se pudieron guardar tus comentarios. Por favor intenta de nuevo.',
}

const vi: RegisterStrings = {
  tagline: 'Đăng ký open house bảo mật',
  loading: 'Đang tải...',
  firstName: 'Tên',
  firstNamePlaceholder: 'Tên',
  lastName: 'Họ',
  lastNamePlaceholder: 'Họ',
  email: 'Địa chỉ email hợp lệ',
  emailPlaceholder: 'ban@email.com',
  phone: 'Số điện thoại hợp lệ',
  timeline: 'Thời gian dự định mua nhà',
  timelines: ['0–3 tháng', '3–6 tháng', '6–12 tháng', 'Trên 12 tháng'],
  errName: 'Vui lòng nhập họ và tên của bạn',
  errEmail: 'Vui lòng nhập địa chỉ email hợp lệ',
  errPhone: 'Vui lòng nhập số điện thoại hợp lệ của Hoa Kỳ hoặc Canada',
  errTimeline: 'Vui lòng chọn thời gian dự định mua nhà',
  errSubmit: 'Đã xảy ra lỗi. Vui lòng thử lại.',
  requestBtn: 'Yêu cầu mã vào cửa →',
  requestBtnName: 'Yêu cầu mã vào cửa',
  submitting: 'Đang gửi mã của bạn...',
  consentSms: 'Khi nhập số điện thoại và nhấn {button}, bạn đồng ý nhận một mã vào cửa dùng một lần qua SMS từ ohACCESS để vào open house này. Có thể áp dụng cước phí tin nhắn và dữ liệu. Trả lời STOP để ngừng nhận, HELP để được trợ giúp.',
  agreePrefix: 'Bạn cũng đồng ý với ',
  termsLink: 'Điều khoản Dịch vụ và Chính sách Bảo mật của ohACCESS',
  agreeSuffix: ', và đồng ý để chuyên viên môi giới chủ trì liên hệ với bạn qua điện thoại, tin nhắn và email về bất động sản này và các bất động sản khác.',
  agreeSuffixSponsored: ', và đồng ý để chuyên viên môi giới chủ trì cùng nhà tài trợ hôm nay, {sponsor}, liên hệ với bạn qua điện thoại, tin nhắn và email về bất động sản này và các bất động sản khác.',
  englishGoverns: 'Nếu có khác biệt, bản tiếng Anh của Điều khoản sẽ được áp dụng.',
  narTitle: 'Không muốn đăng ký?',
  narBody: 'Bạn có thể đặt lịch xem riêng bất động sản này — hoặc bất kỳ bất động sản đang niêm yết nào — với chuyên viên môi giới bên mua mà bạn chọn. Theo quy định của NAR có hiệu lực từ ngày 17/8/2024, bạn cần có thỏa thuận đại diện bên mua bằng văn bản với chuyên viên đó trước khi họ có thể dẫn bạn xem nhà; hầu hết đều có thể chuẩn bị ngay tại chỗ. Đăng ký ohACCESS chỉ bắt buộc để tham dự open house hôm nay.',
  thankYou: 'Cảm ơn bạn!',
  sentBody1: 'Mật mã đã được gửi đến điện thoại của bạn, kèm mật mã dự phòng gửi đến email của bạn.',
  sentBody2: 'Tại cửa, hãy đưa mật mã của bạn cho chủ nhà để được vào.',
  checkPhone: '✓ Mật mã đã được gửi đến điện thoại của bạn.',
  checkEmail: '✓ Mật mã dự phòng đã được gửi đến email của bạn.',
  checkAgent: '✓ Chuyên viên môi giới đã được thông báo về sự có mặt của bạn.',
  feedbackIntro: '{after} khi tham quan, vui lòng trả lời các câu hỏi sau.',
  feedbackAfter: 'Sau',
  feedbackQ1: 'Xét về đặc điểm, vị trí và tình trạng của ngôi nhà, bạn đánh giá tổng thể như thế nào?',
  feedbackQ2: 'Xét về đặc điểm, vị trí và tình trạng của ngôi nhà, bạn thấy mức giá thế nào?',
  feedbackScaleLow: 'Kém',
  feedbackScaleHigh: 'Xuất sắc',
  feedbackPrices: ['Quá cao', 'Hợp lý', 'Quá thấp'],
  feedbackSubmit: 'Gửi phản hồi',
  feedbackSubmitting: 'Đang gửi…',
  feedbackThanks: 'Cảm ơn bạn! Phản hồi của bạn đã được chia sẻ với chuyên viên môi giới cho người bán.',
  feedbackError: 'Không thể lưu phản hồi của bạn. Vui lòng thử lại.',
}

const zh: RegisterStrings = {
  tagline: '安全的开放看房登记',
  loading: '加载中...',
  firstName: '名字',
  firstNamePlaceholder: '名',
  lastName: '姓氏',
  lastNamePlaceholder: '姓',
  email: '有效电子邮箱',
  emailPlaceholder: 'you@email.com',
  phone: '有效电话号码',
  timeline: '购房时间计划',
  timelines: ['0–3 个月', '3–6 个月', '6–12 个月', '12 个月以上'],
  errName: '请输入您的姓名',
  errEmail: '请输入有效的电子邮箱地址',
  errPhone: '请输入有效的美国或加拿大电话号码',
  errTimeline: '请选择购房时间计划',
  errSubmit: '出了点问题，请重试。',
  requestBtn: '获取门禁码 →',
  requestBtnName: '获取门禁码',
  submitting: '正在发送您的门禁码...',
  consentSms: '输入您的电话号码并点击{button}，即表示您同意接收 ohACCESS 发送的一次性短信门禁码，用于进入本次开放看房。可能会产生短信和流量费用。回复 STOP 退订，回复 HELP 获取帮助。',
  agreePrefix: '您还同意 ',
  termsLink: 'ohACCESS 服务条款和隐私政策',
  agreeSuffix: '，并同意接待经纪人通过电话、短信和电子邮件就本房产及其他房产与您联系。',
  agreeSuffixSponsored: '，并同意接待经纪人及今日赞助商 {sponsor} 通过电话、短信和电子邮件就本房产及其他房产与您联系。',
  englishGoverns: '如有歧义，以条款的英文版本为准。',
  narTitle: '不想登记？',
  narBody: '您可以选择自己信任的买方经纪人，预约私下参观这套房——或任何在售房源。根据 2024 年 8 月 17 日生效的 NAR 规定，经纪人带您看房前需与您签署书面买方代理协议；大多数经纪人可当场准备。ohACCESS 登记仅用于参加今天的开放看房。',
  thankYou: '谢谢！',
  sentBody1: '暗号已发送到您的手机，备用暗号已发送到您的邮箱。',
  sentBody2: '在门口向接待人员出示您的暗号即可进入。',
  checkPhone: '✓ 暗号已发送到您的手机。',
  checkEmail: '✓ 备用暗号已发送到您的邮箱。',
  checkAgent: '✓ 经纪人已收到您到访的通知。',
  feedbackIntro: '{after}，请回答以下问题。',
  feedbackAfter: '参观后',
  feedbackQ1: '综合考虑房屋的特点、位置和状况，您对它的总体评价如何？',
  feedbackQ2: '综合考虑房屋的特点、位置和状况，您觉得价格如何？',
  feedbackScaleLow: '较差',
  feedbackScaleHigh: '极好',
  feedbackPrices: ['偏高', '合理', '偏低'],
  feedbackSubmit: '提交反馈',
  feedbackSubmitting: '正在提交…',
  feedbackThanks: '谢谢！您的反馈已分享给经纪人以转告卖家。',
  feedbackError: '无法保存您的反馈，请重试。',
}

const ko: RegisterStrings = {
  tagline: '안전한 오픈하우스 등록',
  loading: '불러오는 중...',
  firstName: '이름',
  firstNamePlaceholder: '이름',
  lastName: '성',
  lastNamePlaceholder: '성',
  email: '유효한 이메일 주소',
  emailPlaceholder: 'you@email.com',
  phone: '유효한 전화번호',
  timeline: '주택 구입 예정 시기',
  timelines: ['0–3개월', '3–6개월', '6–12개월', '12개월 이상'],
  errName: '성과 이름을 입력해 주세요',
  errEmail: '유효한 이메일 주소를 입력해 주세요',
  errPhone: '유효한 미국 또는 캐나다 전화번호를 입력해 주세요',
  errTimeline: '구입 예정 시기를 선택해 주세요',
  errSubmit: '문제가 발생했습니다. 다시 시도해 주세요.',
  requestBtn: '출입 코드 요청 →',
  requestBtnName: '출입 코드 요청',
  submitting: '코드를 보내는 중...',
  consentSms: '전화번호를 입력하고 {button} 버튼을 누르면, 이 오픈하우스 입장을 위한 일회용 SMS 출입 코드를 ohACCESS로부터 받는 데 동의하는 것입니다. 메시지 및 데이터 요금이 부과될 수 있습니다. 수신 거부는 STOP, 도움말은 HELP를 회신하세요.',
  agreePrefix: '또한 ',
  termsLink: 'ohACCESS 서비스 약관 및 개인정보 처리방침',
  agreeSuffix: '에 동의하며, 호스트 에이전트가 이 매물 및 다른 매물에 관해 전화, 문자, 이메일로 연락하는 데 동의합니다.',
  agreeSuffixSponsored: '에 동의하며, 호스트 에이전트와 오늘의 스폰서 {sponsor}이(가) 이 매물 및 다른 매물에 관해 전화, 문자, 이메일로 연락하는 데 동의합니다.',
  englishGoverns: '해석에 차이가 있을 경우 약관의 영문본이 우선합니다.',
  narTitle: '등록을 원하지 않으세요?',
  narBody: '원하시는 바이어 에이전트와 함께 이 매물 — 또는 다른 어떤 매물이든 — 개인 쇼잉을 예약하실 수 있습니다. 2024년 8월 17일부터 시행된 NAR 규정에 따라, 에이전트가 집을 보여드리기 전에 서면 바이어 대리 계약이 필요하며, 대부분의 에이전트가 현장에서 바로 준비해 드릴 수 있습니다. ohACCESS 등록은 오늘 오픈하우스 참석에만 필요합니다.',
  thankYou: '감사합니다!',
  sentBody1: '암호가 휴대폰으로 전송되었고, 예비 암호가 이메일로 전송되었습니다.',
  sentBody2: '문 앞에서 암호를 호스트에게 알려주시면 입장하실 수 있습니다.',
  checkPhone: '✓ 암호가 휴대폰으로 전송되었습니다.',
  checkEmail: '✓ 예비 암호가 이메일로 전송되었습니다.',
  checkAgent: '✓ 에이전트에게 도착이 통지되었습니다.',
  feedbackIntro: '{after}, 아래 질문에 답변해 주세요.',
  feedbackAfter: '둘러보신 후',
  feedbackQ1: '집의 특징, 위치, 상태를 고려할 때 전반적으로 어떻게 평가하시겠어요?',
  feedbackQ2: '집의 특징, 위치, 상태를 고려할 때 가격에 대해 어떻게 생각하세요?',
  feedbackScaleLow: '나쁨',
  feedbackScaleHigh: '훌륭함',
  feedbackPrices: ['너무 높음', '적절함', '너무 낮음'],
  feedbackSubmit: '피드백 제출',
  feedbackSubmitting: '보내는 중…',
  feedbackThanks: '감사합니다! 남겨 주신 의견은 판매자를 위해 에이전트에게 전달되었습니다.',
  feedbackError: '피드백을 저장하지 못했습니다. 다시 시도해 주세요.',
}

const hi: RegisterStrings = {
  tagline: 'सुरक्षित ओपन हाउस पंजीकरण',
  loading: 'लोड हो रहा है...',
  firstName: 'पहला नाम',
  firstNamePlaceholder: 'पहला नाम',
  lastName: 'उपनाम',
  lastNamePlaceholder: 'उपनाम',
  email: 'मान्य ईमेल पता',
  emailPlaceholder: 'you@email.com',
  phone: 'मान्य फ़ोन नंबर',
  timeline: 'घर खरीदने की समय-सीमा',
  timelines: ['0–3 महीने', '3–6 महीने', '6–12 महीने', '12+ महीने'],
  errName: 'कृपया अपना पूरा नाम दर्ज करें',
  errEmail: 'कृपया मान्य ईमेल पता दर्ज करें',
  errPhone: 'कृपया मान्य अमेरिकी या कनाडाई फ़ोन नंबर दर्ज करें',
  errTimeline: 'कृपया समय-सीमा चुनें',
  errSubmit: 'कुछ गलत हो गया। कृपया फिर से प्रयास करें।',
  requestBtn: 'एक्सेस कोड प्राप्त करें →',
  requestBtnName: 'एक्सेस कोड प्राप्त करें',
  submitting: 'आपका कोड भेजा जा रहा है...',
  consentSms: 'अपना नंबर दर्ज करके और {button} पर टैप करके, आप इस ओपन हाउस में प्रवेश के लिए ohACCESS से एक बार का SMS एक्सेस कोड प्राप्त करने के लिए सहमत होते हैं। संदेश और डेटा दरें लागू हो सकती हैं। ऑप्ट-आउट के लिए STOP, सहायता के लिए HELP लिखकर जवाब दें।',
  agreePrefix: 'आप ',
  termsLink: 'ohACCESS सेवा की शर्तों और गोपनीयता नीति',
  agreeSuffix: ' से भी सहमत होते हैं, और इस बात की सहमति देते हैं कि होस्ट एजेंट इस और अन्य संपत्तियों के बारे में आपसे फ़ोन, टेक्स्ट और ईमेल द्वारा संपर्क कर सकते हैं।',
  agreeSuffixSponsored: ' से भी सहमत होते हैं, और इस बात की सहमति देते हैं कि होस्ट एजेंट और आज के प्रायोजक, {sponsor}, इस और अन्य संपत्तियों के बारे में आपसे फ़ोन, टेक्स्ट और ईमेल द्वारा संपर्क कर सकते हैं।',
  englishGoverns: 'किसी भी विसंगति की स्थिति में शर्तों का अंग्रेज़ी संस्करण मान्य होगा।',
  narTitle: 'पंजीकरण नहीं करना चाहते?',
  narBody: 'आप अपनी पसंद के बायर एजेंट के साथ इस — या किसी भी — सूचीबद्ध संपत्ति की निजी शोइंग निर्धारित कर सकते हैं। 17 अगस्त 2024 से प्रभावी NAR नियमों के अनुसार, एजेंट द्वारा घर दिखाने से पहले आपको उनके साथ लिखित बायर प्रतिनिधित्व समझौता करना होगा; अधिकांश एजेंट इसे मौके पर ही तैयार कर सकते हैं। ohACCESS पंजीकरण केवल आज के ओपन हाउस में शामिल होने के लिए आवश्यक है।',
  thankYou: 'धन्यवाद!',
  sentBody1: 'कोडवर्ड आपके फ़ोन पर भेज दिया गया है, और बैकअप कोडवर्ड आपके ईमेल पर भेजा गया है।',
  sentBody2: 'दरवाज़े पर, प्रवेश पाने के लिए अपना कोडवर्ड होस्ट को बताएं।',
  checkPhone: '✓ कोडवर्ड आपके फ़ोन पर भेज दिया गया है।',
  checkEmail: '✓ बैकअप कोडवर्ड आपके ईमेल पर भेज दिया गया है।',
  checkAgent: '✓ एजेंट को आपके आगमन की सूचना दे दी गई है।',
  feedbackIntro: '{after}, कृपया नीचे दिए गए प्रश्नों के उत्तर दें।',
  feedbackAfter: 'दौरे के बाद',
  feedbackQ1: 'घर की विशेषताओं, स्थान और स्थिति को ध्यान में रखते हुए, आप इसे कुल मिलाकर कैसे आंकेंगे?',
  feedbackQ2: 'घर की विशेषताओं, स्थान और स्थिति को ध्यान में रखते हुए, आपको कीमत के बारे में कैसा लगता है?',
  feedbackScaleLow: 'खराब',
  feedbackScaleHigh: 'उत्कृष्ट',
  feedbackPrices: ['बहुत ज़्यादा', 'उचित', 'बहुत कम'],
  feedbackSubmit: 'प्रतिक्रिया भेजें',
  feedbackSubmitting: 'भेजा जा रहा है…',
  feedbackThanks: 'धन्यवाद! आपकी प्रतिक्रिया विक्रेता के लिए एजेंट के साथ साझा कर दी गई है।',
  feedbackError: 'आपकी प्रतिक्रिया सहेजी नहीं जा सकी। कृपया फिर से प्रयास करें।',
}

export const STRINGS: Record<Lang, RegisterStrings> = { en, es, vi, zh, ko, hi }

const LANG_STORAGE_KEY = 'ohaccess_lang'

// Best-guess starting language: a previously chosen one wins, else the
// device language, else English. Safe to call only in the browser.
export function detectLang(): Lang {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY)
    if (saved && saved in STRINGS) return saved as Lang
  } catch { /* storage blocked — fall through to device language */ }
  const device = (navigator.language || '').toLowerCase()
  for (const { code } of LANGS) {
    if (code !== 'en' && device.startsWith(code)) return code
  }
  return 'en'
}

export function saveLang(code: Lang): void {
  try { window.localStorage.setItem(LANG_STORAGE_KEY, code) } catch { /* best effort */ }
}
