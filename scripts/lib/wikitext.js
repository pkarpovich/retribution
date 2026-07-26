function findTemplates(text, name) {
  const results = [];
  const opener = `{{${name}`;
  let from = 0;

  while (true) {
    const start = text.indexOf(opener, from);
    if (start === -1) return results;

    const nextChar = text[start + opener.length];
    if (nextChar && /[A-Za-z0-9]/.test(nextChar)) {
      from = start + opener.length;
      continue;
    }

    let depth = 2;
    let i = start + 2;
    while (i < text.length && depth > 0) {
      if (text.startsWith('{{', i)) { depth += 2; i += 2; continue; }
      if (text.startsWith('}}', i)) { depth -= 2; i += 2; continue; }
      i += 1;
    }

    results.push(text.slice(start + opener.length, i - 2));
    from = i;
  }
}

function splitParams(body) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < body.length; i++) {
    if (body.startsWith('{{', i) || body.startsWith('[[', i)) { depth += 1; current += body.slice(i, i + 2); i += 1; continue; }
    if (body.startsWith('}}', i) || body.startsWith(']]', i)) { depth -= 1; current += body.slice(i, i + 2); i += 1; continue; }
    if (body[i] === '|' && depth === 0) { parts.push(current); current = ''; continue; }
    current += body[i];
  }
  parts.push(current);
  return parts;
}

export function parseTemplates(text, name) {
  return findTemplates(text, name).map(body => {
    const params = {};
    for (const part of splitParams(body)) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim().toLowerCase();
      if (!key || /\s/.test(key)) continue;
      params[key] = part.slice(eq + 1).trim();
    }
    return params;
  });
}

export function stripMarkup(value) {
  if (!value) return '';
  let out = value;
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/\{\{bgcolortext\|[^|}]*\|([^}]*)\}\}/g, '$1');
  out = out.replace(/\{\{(?:ai|link|hero)\|([^}|]*)(?:\|[^}]*)?\}\}/gi, '$1');
  out = out.replace(/\{\{[^{}]*\}\}/g, '');
  out = out.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');
  out = out.replace(/<br\s*\/?>/gi, ' ');
  out = out.replace(/<\/?[a-z][^>]*>/gi, '');
  out = out.replace(/'{2,}/g, '');
  return out.replace(/\s+/g, ' ').trim();
}
