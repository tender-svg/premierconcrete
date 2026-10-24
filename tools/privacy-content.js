/* Text of the Privacy Policy page (privacy-policy.html), written only from what the website really does (forms, CMS login, page cache, cookie choice,
 * ZoomInfo, YouTube / Vimeo players). Drafted for the site owner to review - it is not legal advice. Every text is editable afterwards with the CMS. */
const H = 'font-size:26px;line-height:1.25;margin:44px 0 12px;font-weight:700;color:var(--color-text)';
const P = 'font-size:16px;line-height:1.7;margin:0 0 14px;color:var(--color-neutral-800)';
const UL = 'font-size:16px;line-height:1.7;margin:0 0 14px;padding-left:22px;color:var(--color-neutral-800)';
const TH = 'text-align:left;padding:10px 12px;background:var(--color-accent-900);color:#fff;font-size:13px;letter-spacing:.04em';
const TD = 'padding:10px 12px;border-bottom:1px solid var(--color-divider);vertical-align:top;font-size:14.5px;line-height:1.55;color:var(--color-neutral-800)';
const h = t => '<h2' + (t === 'Cookies and similar technologies' ? ' id="cookies"' : '') + ' style="' + H + '">' + t + '</h2>';
const p = t => '<p style="' + P + '">' + t + '</p>';
const ul = items => '<ul style="' + UL + '">' + items.map(i => '<li>' + i + '</li>').join('') + '</ul>';
const row = c => '<tr>' + c.map((x, i) => '<td style="' + TD + (i === 0 ? ';font-weight:600' : '') + '">' + x + '</td>').join('') + '</tr>';

module.exports = function privacyHtml(wrapStyle) {
  return '<div style="' + wrapStyle + '"><div style="max-width:900px">' +
    p('Last updated: October 24, 2026') +
    p('Premier Concrete Products, Inc. (&ldquo;Premier Concrete&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) respects your privacy. This policy explains what information this website collects, how cookies and similar technologies are used, which third parties are involved, and the choices you have.') +
    h('Who we are') +
    p('Premier Concrete Products, Inc., 38200 LA Highway 16, Denham Springs, LA 70706. Louisiana plant office: +1 225.667.4545. For any privacy question, call us or use the contact form on this website.') +
    h('Information you give us') +
    p('When you use a form on this website we receive what you type into it:') +
    ul(['<b>Contact form:</b> your name, email, phone, company, project location, the product you are asking about and your message.',
      '<b>Lunch &amp; Learn request:</b> your contact details, company, expected attendees, preferred dates, topics and notes.',
      '<b>Credit Application:</b> company and ownership details, contact details, trade and bank references, sales-tax information, guarantor details and the name, title and signature of the person signing. Please only submit information you are authorised to share.']) +
    p('We use this information to answer your request, prepare quotes and deliveries, set up and review credit accounts, and keep a record of our business dealings with you. Form messages are sent to our team by email.') +
    h('Information collected automatically') +
    p('Like most websites, our servers and hosting provider may record technical information such as your IP address, browser type, device, the pages you open and the time of your visit. We use it to keep the website secure and working.') +
    h('Cookies and similar technologies') +
    p('Cookies are small files stored in your browser. The cookies and third-party services this website uses are:') +
    '<div style="overflow-x:auto;margin:0 0 18px"><table style="width:100%;border-collapse:collapse;min-width:640px"><thead><tr><th style="' + TH + '">Name / service</th><th style="' + TH + '">Type</th><th style="' + TH + '">Purpose</th><th style="' + TH + '">Category</th></tr></thead><tbody>' +
    row(['admin_token', 'Cookie', 'Used only for authorised Premier Concrete staff who sign in through the CMS Login link: keeps them signed in while they manage the website content. They are not set for ordinary visitors.', 'Necessary']) +
    row(['ZoomInfo', 'Third-party cookies and scripts', 'See &ldquo;ZoomInfo&rdquo; below. Loaded only if you accept marketing &amp; analytics cookies.', 'Marketing &amp; analytics']) +
    '</tbody></table></div>' +
    p('When you first visit, a cookie banner lets you accept, deny or choose your preferences. You can change your choice at any time with the &ldquo;Cookie Settings&rdquo; link at the bottom of every page. You can also delete cookies and local storage in your browser settings; the website still works, but your choice will be asked again.') +
    h('CMS Login (staff only)') +
    p('The &ldquo;CMS Login&rdquo; link in the footer leads to a sign-in page for authorised Premier Concrete staff who edit the website&rsquo;s content. It is not needed to browse the website or to send a request to us. When staff sign in we process the sign-in details they enter, set the admin_token login cookie described above, and keep a history of the content changes they make. Visitors should not attempt to sign in.') +
    h('ZoomInfo') +
    p('We use ZoomInfo, a third-party business information and sales-intelligence service. If you accept marketing &amp; analytics cookies, a ZoomInfo script on this website may set cookies and collect technical information such as your IP address, browser and device details and the pages you view, so that ZoomInfo can recognise which business is visiting the website and help us understand which companies are interested in our products. If you do not accept these cookies, the ZoomInfo script is not loaded. ZoomInfo handles information under its own privacy policy, available on <a href="https://www.zoominfo.com" target="_blank" rel="noopener" style="color:var(--color-accent-700);font-weight:600">zoominfo.com</a>, where you can also find how to exercise your choices with them.') +
    h('Who we share information with') +
    ul(['Service providers that help us run the website and our business, such as web hosting, email delivery and the content management system, who may only use information to provide their service to us.',
      'ZoomInfo, as described above.',
      'Authorities or advisers when the law requires it or to protect our rights.']) +
    p('We do not sell the information you send us through our forms.') +
    h('How long we keep information') +
    p('We keep form submissions and credit-application records for as long as needed to deal with your request, manage your account and meet legal, tax and accounting obligations, and then delete or anonymise them.') +
    h('Your choices and rights') +
    p('Depending on where you live, you may have the right to ask what personal information we hold about you, to correct or delete it, and to object to or limit certain uses, including cookie-based marketing. To make a request, call us or use the contact form and tell us what you would like. You can change your cookie choice at any time with &ldquo;Cookie Settings&rdquo;.') +
    h('Security') +
    p('We take reasonable steps to protect information sent through this website, including encrypted connections. No method of transmission over the internet is completely secure, so please avoid sending information you consider highly sensitive by an unsecured channel.') +
    h('Children') +
    p('This website is intended for businesses and is not directed to children under 13. We do not knowingly collect information from children.') +
    h('Changes to this policy') +
    p('We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the top shows when it was last changed.') +
    h('Contact us') +
    p('Premier Concrete Products, Inc., 38200 LA Highway 16, Denham Springs, LA 70706. Phone: +1 225.667.4545 or +1 800.575.7293. Or use the <a href="contact.html" style="color:var(--color-accent-700);font-weight:600">contact form</a>.') +
    '</div></div>';
};
