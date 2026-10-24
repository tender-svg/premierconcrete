// jsdom test of the three forms (contact, Lunch & Learn, Credit Application): the payload sent to /api/contact and the thank-you / error behaviour.
// The backend is a stub (nothing is sent anywhere).   node tools/test-forms.js
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function load(file, answer) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/' + file, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; w.scrollTo = () => { }; const sent = [];
  w.fetch = (url, o) => { sent.push({ url, body: JSON.parse(o.body) }); return answer(); };
  w.eval(fs.readFileSync(path.join(ROOT, 'js/site.js'), 'utf8'));
  return { w, d: w.document, sent };
}
const good = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
const bad = () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ success: false, message: 'Failed to send email.' }) });
const submit = (t, f) => f.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
const fillAll = (t, form) => {
  form.querySelectorAll('input,select,textarea').forEach(e => {
    if (e.type === 'radio') { if (![...form.querySelectorAll('input[type=radio][name="' + e.name + '"]')].some(x => x.checked)) e.checked = true; }
    else if (e.type === 'checkbox') e.checked = true; else if (e.tagName === 'SELECT') e.selectedIndex = Math.min(1, e.options.length - 1);
    else if (e.type === 'email') e.value = 'a@b.co'; else if (e.type === 'date') e.value = '2026-01-01'; else if (e.type === 'number') e.value = '12'; else if (e.type === 'tel') e.value = '555-1234'; else if (!e.value) e.value = 'x ' + (e.name || '');
  });
};
(async () => {
  // required / optional: nothing is required that the design marks as optional
  let t = load('credit-application.html', good);
  const opt = t.d.querySelector('[name="cr-0-0-1"]'), req = t.d.querySelector('[name="cr-0-0-0"]');
  ok(!opt.required && req.required, 'credit: "Salesperson" is optional, "Company name" is required');
  ok(!t.d.querySelector('input[type=file]') && /Tax Exempt Certificate/.test(t.d.body.textContent), 'credit: the file field is a note (a file cannot be sent with the form)');

  // contact
  t = load('contact.html', good); let form = t.d.querySelector('form[data-submit="contact"]');
  form.querySelector('[name=name]').value = 'Test Person'; form.querySelector('[name=email]').value = 'test@example.com'; form.querySelector('[name=country]').value = 'United States'; form.querySelector('[name=city]').value = 'Baton Rouge';
  form.querySelector('[name=phone]').value = '555'; form.querySelector('[name=message]').value = 'Hello';
  const sel = form.querySelector('[name=product]'); sel.selectedIndex = 1;
  submit(t, form); await wait(30);
  const p = t.sent[0] && t.sent[0].body;
  ok(t.sent[0].url === '/api/contact' && p.form_type === 'support' && p.name === 'Test Person' && p.email === 'test@example.com' && p.project_country === 'United States' && p.project_city === 'Baton Rouge' && p.message === 'Hello' && !!p.product, 'contact: payload for /api/contact (form_type support)');
  ok(!t.d.querySelector('[data-sent]').hidden && form.hidden, 'contact: thank-you screen shown after the mail went out');
  t = load('contact.html', bad); form = t.d.querySelector('form[data-submit="contact"]');
  form.querySelector('[name=name]').value = 'T'; form.querySelector('[name=email]').value = 'test@example.com'; form.querySelector('[name=country]').value = 'US';
  submit(t, form); await wait(30);
  ok(t.d.querySelector('[data-sent]').hidden && !form.hidden && /could not be sent/.test(t.d.querySelector('.form-err').textContent), 'contact: on a failure the form stays and an error message is shown');
  ok(!form.querySelector('button[type=submit]').disabled && form.querySelector('[name=name]').value === 'T', 'contact: the button works again and nothing typed is lost');
  t = load('contact.html', good); form = t.d.querySelector('form[data-submit="contact"]'); submit(t, form); await wait(30);
  ok(t.sent.length === 0, 'contact: an invalid form is not sent');

  // lunch & learn
  t = load('lunch-learn.html', good); form = t.d.querySelector('form[data-submit="lunch"]');
  form.querySelector('[name=name]').value = 'L Person'; form.querySelector('[name=company]').value = 'ACME'; form.querySelector('[name=email]').value = 'l@example.com'; form.querySelector('[name=expected_attendees]').value = '20';
  form.querySelectorAll('[name=topics]')[0].checked = true; form.querySelectorAll('[name=topics]')[2].checked = true;
  submit(t, form); await wait(30);
  const l = t.sent[0] && t.sent[0].body;
  ok(l && l.form_type === 'lunch_learn' && l.company === 'ACME' && /Pipe Culverts, Drainage/.test(l.product) && /Expected attendees: 20/.test(l.message), 'lunch: payload (form_type lunch_learn, topics, attendees)');
  ok(!t.d.querySelector('[data-sent]').hidden, 'lunch: thank-you screen shown');

  // credit application
  t = load('credit-application.html', good); form = t.d.querySelector('form[data-submit="credit"]');
  fillAll(t, form);
  form.querySelector('[name="cr-0-0-0"]').value = 'ACME Inc'; form.querySelector('[name="cr-0-0-19"]').value = 'credit@acme.test'; form.querySelector('[name="cr-7-0-0"]').value = 'Jane Signer';
  submit(t, form); await wait(30);
  const c = t.sent[0] && t.sent[0].body;
  ok(c && c.form_type === 'credit_application' && c.company === 'ACME Inc' && c.email === 'credit@acme.test' && c.name === 'Jane Signer' && c.sign_name === 'Jane Signer', 'credit: payload (company, email, signer)');
  ok(c && c.ref1_company && c.bank_name && c.owners && c.fed_tax_id && c.business_type && c.po_required && c.agree_terms === 'Yes' && c.agree_guaranty === 'Yes' && c.agree_tos === 'Yes' && c.guarantor_name, 'credit: references, bank, owners, tax id, agreements are all sent');
  ok(!t.d.querySelector('[data-sent]').hidden, 'credit: thank-you screen shown');
  console.log(fail ? fail + ' failed' : 'all ok'); process.exit(fail ? 1 : 0);
})();
