// What the team writes in the activity feed, in the owner's language. {name} = a value filled in.
const W = {
  phone_live: ['Phone link is live: {u}', 'بەستەری مۆبایل کارایە: {u}', 'رابط الهاتف يعمل: {u}'],
  phone_paired: ['Phone paired: {name}', 'مۆبایل پەیوەستکرا: {name}', 'تم ربط الهاتف: {name}'],
  sleep_on: ['Sleep mode on: the team works alone and the Judge approves. Anything risky waits for you.', 'دۆخی خەو کارایە: تیمەکە بە تەنها کار دەکات و دادوەر پەسەند دەکات. هەر شتێکی مەترسیدار چاوەڕێی تۆ دەکات.', 'وضع النوم مفعّل: الفريق يعمل وحده والحَكَم يوافق. أي شيء فيه خطورة ينتظرك.'],
  awake: ['Awake mode: you approve everything again.', 'دۆخی بەئاگا: دیسان هەموو شتێک بە ڕەزامەندی تۆیە.', 'وضع الاستيقاظ: أنت توافق على كل شيء من جديد.'],
  putting_online: ["Putting {b}'s demo online…", 'دیمۆی {b} بڵاو دەکرێتەوە…', 'جارٍ نشر نموذج {b}…'],
  online: ["{b}'s demo is online: {u}", 'دیمۆی {b} بڵاوکرایەوە: {u}', 'نموذج {b} منشور: {u}'],
  online_judge: ["{b}'s demo is online (approved by the Judge): {u}", 'دیمۆی {b} بڵاوکرایەوە (دادوەر پەسەندی کرد): {u}', 'نموذج {b} منشور (بموافقة الحَكَم): {u}'],
  judge_demo_ok: ["Judge on {b}'s demo: {s}/100, safe to put online. {sum}", 'دادوەر دەربارەی دیمۆی {b}: {s}/100، سەلامەتە بۆ بڵاوکردنەوە. {sum}', 'الحَكَم على نموذج {b}: {s}/100، آمن للنشر. {sum}'],
  judge_demo_hold: ["Judge on {b}'s demo: {s}/100, held for you. {sum}", 'دادوەر دەربارەی دیمۆی {b}: {s}/100، بۆ تۆ ڕاگیرا. {sum}', 'الحَكَم على نموذج {b}: {s}/100، محجوز لك. {sum}'],
  online_fail: ["Could not put {b}'s demo online: {e}", 'نەتوانرا دیمۆی {b} بڵاو بکرێتەوە: {e}', 'تعذّر نشر نموذج {b}: {e}'],
  judge_msg_ok: ['Judge on the message to {b}: {s}/100, safe to send. {sum}', 'دادوەر دەربارەی نامەی {b}: {s}/100، سەلامەتە بۆ ناردن. {sum}', 'الحَكَم على الرسالة إلى {b}: {s}/100، آمنة للإرسال. {sum}'],
  judge_msg_fix: ['Judge on the message to {b}: {s}/100, safe after small fixes. {sum}', 'دادوەر دەربارەی نامەی {b}: {s}/100، دوای چاککردنی بچووک سەلامەتە. {sum}', 'الحَكَم على الرسالة إلى {b}: {s}/100، آمنة بعد تعديلات بسيطة. {sum}'],
  judge_msg_hold: ['Judge on the message to {b}: {s}/100, held for you. {sum}', 'دادوەر دەربارەی نامەی {b}: {s}/100، بۆ تۆ ڕاگیرا. {sum}', 'الحَكَم على الرسالة إلى {b}: {s}/100، محجوزة لك. {sum}'],
  auto_sent: ['Sent by itself to {to} after the Judge approved it.', 'دوای پەسەندکردنی دادوەر بە خۆکاری نێردرا بۆ {to}.', 'أُرسلت تلقائياً إلى {to} بعد موافقة الحَكَم.'],
  auto_fail: ['Automatic sending failed ({e}); the message is ready for you to send.', 'ناردنی خۆکار سەرکەوتوو نەبوو ({e})؛ نامەکە ئامادەیە بۆ ئەوەی خۆت بینێریت.', 'فشل الإرسال التلقائي ({e})؛ الرسالة جاهزة لترسلها بنفسك.'],
  auto_ready: ['Message to {b} approved by the Judge: one tap to send it in the morning.', 'نامەی {b} دادوەر پەسەندی کرد: بەیانی بە یەک کرتە بینێرە.', 'وافق الحَكَم على الرسالة إلى {b}: نقرة واحدة لإرسالها صباحاً.'],
  schedule_ran: ['Scheduled task started: {w}', 'ئەرکی خشتەکراو دەستی پێکرد: {w}', 'بدأت مهمة مجدولة: {w}'],
  new_search: ['New search: {n} {niche} in {city}', 'گەڕانی نوێ: {n} {niche} لە {city}', 'بحث جديد: {n} {niche} في {city}'],
  sent: ['Message sent to {to}', 'نامە نێردرا بۆ {to}', 'أُرسلت الرسالة إلى {to}'],
  rejected: ['Rejected: {t}', 'ڕەتکرایەوە: {t}', 'مرفوض: {t}'],
  approved: ['Approved: {t}', 'پەسەندکرا: {t}', 'تمت الموافقة: {t}'],
  found: ['Found {b} ({city})', '{b} دۆزرایەوە ({city})', 'تم العثور على {b} ({city})'],
  profile_ok: ['{b}: profile ready', '{b}: پرۆفایل ئامادەیە', '{b}: الملف جاهز'],
  profile_fail: ['{b}: could not be verified, skipped', '{b}: پشتڕاست نەکرایەوە، تێپەڕێنرا', '{b}: تعذّر التحقق، تم التخطي'],
  score_build: ['{b}: {s}/100, worth building', '{b}: {s}/100، شایەنی دروستکردنە', '{b}: {s}/100، يستحق البناء'],
  score_hold: ['{b}: {s}/100, kept for later', '{b}: {s}/100، بۆ دواتر هەڵگیرا', '{b}: {s}/100، محفوظ لاحقاً'],
  score_skip: ['{b}: {s}/100, skipped', '{b}: {s}/100، تێپەڕێنرا', '{b}: {s}/100، تم التخطي'],
  plan: ['{b}: plan ready ({p})', '{b}: پلان ئامادەیە ({p})', '{b}: الخطة جاهزة ({p})'],
  rv_approve: ['{b}: approved for a demo', '{b}: بۆ دیمۆ پەسەندکرا', '{b}: تمت الموافقة على نموذج'],
  rv_hold: ['{b}: on hold', '{b}: ڕاگیرا', '{b}: معلّق'],
  rv_reject: ['{b}: rejected by the Reviewer', '{b}: پێداچوونەوەکەر ڕەتی کردەوە', '{b}: رفضه المراجِع'],
  demo_ready: ['Demo ready: {b}', 'دیمۆ ئامادەیە: {b}', 'النموذج جاهز: {b}'],
  needs_you: ['Needs your approval: {t}', 'پێویستی بە پەسەندکردنی تۆیە: {t}', 'يحتاج موافقتك: {t}'],
  started: ['{a} started {w}', '{a} دەستی پێکرد {w}', 'بدأ {a} {w}'],
  finished: ['{a} finished {w}', '{a} تەواو بوو {w}', 'أنهى {a} {w}'],
  failed: ['{a} ran into a problem with {w}', '{a} تووشی کێشە بوو لە {w}', 'واجه {a} مشكلة في {w}'],
  stopped: ['{a} was stopped on {w}', '{a} وەستێنرا لە {w}', 'تم إيقاف {a} في {w}'],
  search_done: ['Search finished: {n} {niche} in {city} checked, {d} demos ready for you.', 'گەڕان تەواو بوو: {n} {niche} لە {city} پشکنران، {d} دیمۆ بۆت ئامادەن.', 'انتهى البحث: تم فحص {n} {niche} في {city}، {d} نماذج جاهزة لك.'],
};
const IDX = { en: 0, ckb: 1, ar: 2 };
export const words = (config) => (key, p = {}) => {
  const row = W[key];
  if (!row) return key;
  return (row[IDX[config.data.ui_language] ?? 0] || row[0]).replace(/\{(\w+)\}/g, (_, x) => (p[x] ?? '')).replace(/\s+\./g, '.').trim();
};
