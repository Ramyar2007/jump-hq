// Jump HQ Cloud landing + account page. English / Kurdish Sorani.
(() => {
  const CKB = {
    nav_how: 'چۆن کار دەکات', nav_price: 'نرخەکان', signin: 'چوونەژوورەوە',
    hero_eyebrow: 'لە سلێمانی دروستکراوە',
    hero_h: 'تیمێکی AI کە کڕیارەکانت دەدۆزێتەوە و سۆشیاڵ میدیاکەت بەڕێوە دەبات.',
    hero_p: 'بۆ بازرگانییە ئۆنلاینەکان و فریلانسەرەکان. Jump HQ ئەو کڕیارانە دەدۆزێتەوە کە پێویستیان بەوەیە تۆ دەیفرۆشیت، بۆ هەر یەکێک نموونەیەکی بێبەرامبەر دروست دەکات و یەکەم نامەی واتسئاپ دەنووسێت. دۆخی گەشەکردن پۆست و ڤیدیۆ کورتەکانت دروست دەکات و لە کاتی خۆیدا بڵاویان دەکاتەوە. هیچ شتێک بێ ڕەزامەندی تۆ ناڕوات.',
    cta: '٧ ڕۆژ بێبەرامبەر دەست پێبکە', cta_note: 'دامەزراندن نییە. هەژماری AI ناوێت. لەسەر مۆبایلیش کار دەکات.',
    p1: 'دۆخ: دۆزینەوەی کڕیار، و گەشەپێدانی پەیجەکانت', p2: 'تیمەکەت کار دەکات، تەنانەت کاتێک دەخەویت', p3: 'زمان: کوردی، عەرەبی، ئینگلیزی', p4: 'تێچووی AI بۆ هەر نموونەیەکی بێبەرامبەر، نزیکەی',
    how_h: 'تیمەکەت هەموو ڕۆژێک چی دەکات',
    s1h: 'دەدۆزێتەوە', s1: 'کڕیار بە نیشانەی کڕین: کەسانێک کە داوای خزمەتگوزارییەکەت دەکەن، براندەکان کە پارە بۆ ڕیکلام دەدەن، دوکانەکان کە پەیجەکانیان بێدەنگ بووە.',
    s2h: 'دەپشکنێت', s2: 'ڕاستەقینەیە؟ کراوەیە؟ دەتوانیت پەیوەندی پێوە بکەیت؟ دەیکڕێت؟ لاوازەکان بە هۆکارەوە لادەبرێن.',
    s3h: 'دروست دەکات', s3: 'نموونەیەکی بێبەرامبەری کارەکەت بۆ هەر کڕیارێکی باش: بیرۆکەی ڕیکلام، پەڕەی فرۆشگا، ڕاپۆرت، نموونەی ئەپ.',
    s4h: 'دەنووسێت', s4: 'یەکەم نامەی واتسئاپ بە سۆرانییەکی سروشتی، و پۆست و ڤیدیۆ کورتە ڕۆژانەکانی خۆت. دادوەری AI هەموو وشەیەک دەپشکنێت، پاشان تۆ ڕەزامەندی دەدەیت.',
    how_sleep: 'شەوان دۆخی خەو هەڵبکە: دادوەرەکە کاری شەو دەکات و بەیانی ڕاپۆرتێکت بۆ دێت.',
    price_h: 'پلانی مانگانەی سادە', price_p: 'یەک کڕیاری نوێ تێچووی ساڵێکی Pro دەداتەوە.',
    pl_trial: 'تاقیکردنەوەی بێبەرامبەر', pl_week: 'بۆ ٧ ڕۆژ', pl_mo: 'مانگانە',
    pl_t1: '٦ کاری تیم لە ڕۆژێکدا', pl_t2: 'نزیکەی ٢ گەڕان، ٣ نموونە و پۆستی هەفتەیەک', pl_t3: 'هەموو شتێک لەخۆدەگرێت',
    pl_s1: '٢٥ کاری تیم لە ڕۆژێکدا', pl_s2: 'هەردوو دۆخ: کڕیار و پۆستی ڕۆژانە', pl_s3: 'دۆخی خەو، دادوەری AI، ئەپی مۆبایل',
    pl_p1: '٨٠ کاری تیم لە ڕۆژێکدا', pl_p2: 'چەند براندێک، ٣ هێندەی کار', pl_p3: 'بۆ ئاژانس و تیمە بچووکەکان',
    pick_trial: 'بێبەرامبەر دەست پێبکە', pick: 'Pro هەڵبژێرە', pick_pro: 'Agency هەڵبژێرە',
    pay_note: 'پارەدان بە FIB، کارت یان گواستنەوەی بانکی. هەر کاتێک بتەوێت هەڵیبوەشێنەوە.',
    form_h: 'هەفتەی بێبەرامبەرت دەست پێبکە', form_p: 'Jump HQی تایبەتی خۆت لە چەند چرکەیەکدا ئامادە دەبێت. بە یاریدەدەری دامەزراندن بڵێ چی دەفرۆشیت و هەموو تیمەکە خۆی دەگونجێنێت.',
    tab_new: 'هەژماری نوێ', f_name: 'ناوت', f_company: 'ناوی کارەکەت', f_email: 'ئیمەیڵ', f_pw: 'وشەی نهێنی (٨+ پیت)', f_plan: 'پلان',
    go: 'Jump HQی من دروست بکە', go_login: 'چوونەژوورەوە',
    acc_eyebrow: 'هەژمارەکەت', open_hq: 'Jump HQی من بکەرەوە',
    trial_over: 'هەفتە بێبەرامبەرەکەت تەواو بوو. پلانێک لە خوارەوە هەڵبژێرە تا تیمەکەت بەردەوام بێت. بازرگانی و دیمۆکانت پارێزراون.',
    st_plan: 'پلان', st_today: 'کارەکانی ئەمڕۆ', st_demos: 'دیمۆی دروستکراو', st_leads: 'بازرگانیی دۆزراوە', logout: 'چوونەدەرەوە',
    foot: 'هاکاتۆنی SmartSuli AI ٢٠٢٦ · سلێمانی',
  };
  const $ = (s) => document.querySelector(s);
  const EN = {};
  document.querySelectorAll('[data-t]').forEach((e) => { EN[e.dataset.t] = e.textContent; });
  EN.go_login = 'Sign in';
  let lang = localStorage.getItem('jhq-cloud-lang') || 'en';
  let mode = 'signup';
  const t = (k) => (lang === 'ckb' ? CKB[k] : EN[k]) || EN[k] || k;
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ckb' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-t]').forEach((e) => { const v = lang === 'ckb' ? CKB[e.dataset.t] : EN[e.dataset.t]; if (v) e.textContent = v; });
    $('#lang').textContent = lang === 'ckb' ? 'English' : 'کوردی';
    $('#submit').textContent = mode === 'login' ? t('go_login') : t('go');
  }
  $('#lang').onclick = () => { lang = lang === 'ckb' ? 'en' : 'ckb'; localStorage.setItem('jhq-cloud-lang', lang); applyLang(); };

  const form = $('#authForm');
  function setMode(m) {
    mode = m;
    form.classList.toggle('login', m === 'login');
    form.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    form.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('#err').textContent = '';
    applyLang();
  }
  form.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $('#openLogin').onclick = () => { setMode('login'); $('#start').scrollIntoView(); form.email.focus(); };
  document.querySelectorAll('[data-plan]').forEach((b) => (b.onclick = () => {
    if (me) return choosePlan(b.dataset.plan);
    setMode('signup'); form.plan.value = b.dataset.plan; $('#start').scrollIntoView(); form.name.focus();
  }));

  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#submit');
    btn.disabled = true; $('#err').textContent = '';
    const body = Object.fromEntries(new FormData(form));
    try {
      const r = await fetch(`/cloud/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Something went wrong.');
      location.href = '/';
    } catch (err) {
      $('#err').textContent = err.message;
      btn.disabled = false;
    }
  };

  let me = null;
  async function choosePlan(plan) {
    if (plan === 'trial') return;
    const r = await fetch('/cloud/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan }) });
    const j = await r.json();
    $('#planMsg').textContent = j.message || j.error || '';
    loadMe();
  }
  async function loadMe() {
    const r = await fetch('/cloud/me');
    if (!r.ok) return;
    me = await r.json();
    $('#account').hidden = false;
    $('#start').hidden = true;
    $('#openLogin').hidden = true;
    $('#accName').textContent = me.name;
    $('#accEmail').textContent = me.email;
    $('#stPlan').textContent = me.plan_info.name + (me.plan_info.price ? ` · $${me.plan_info.price}` : '');
    $('#stToday').textContent = `${me.usage.jobs_today} / ${me.plan_info.jobs}`;
    $('#stDemos').textContent = me.usage.demos;
    $('#stLeads').textContent = me.usage.leads;
    $('#trialOver').hidden = !me.trial_over;
    $('#openHq').hidden = me.trial_over;
    if (!me.paid && me.plan !== 'trial') $('#planMsg').textContent = `${me.plan_info.name}: waiting for payment. We will send the payment details to ${me.email}.`;
  }
  $('#logout').onclick = async () => { await fetch('/cloud/logout', { method: 'POST' }); location.href = '/'; };
  applyLang();
  loadMe();
})();
