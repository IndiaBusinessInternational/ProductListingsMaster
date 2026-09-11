/* IBI Product Listings Master — sheet export/import (SheetJS loaded on demand from cdnjs) + clipboard */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxP = null;
export function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxP) return xlsxP;
  xlsxP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = XLSX_URL; s.onload = () => res(window.XLSX); s.onerror = () => { xlsxP = null; rej(new Error('Could not load the spreadsheet library (offline?). CSV export still works.')); }; document.head.appendChild(s); });
  return xlsxP;
}
export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export const safeName = s => String(s || 'export').replace(/[^\w.-]+/g, '_').slice(0, 80);

/* sheets: [{name, headerRow, rows, note?: [[...]]}] */
export async function downloadXlsx(filename, sheets) {
  const X = await loadXlsx();
  const wb = X.utils.book_new();
  for (const sh of sheets) {
    const ws = X.utils.aoa_to_sheet([sh.headerRow, ...sh.rows]);
    ws['!cols'] = sh.headerRow.map((h, i) => ({ wch: Math.min(60, Math.max(12, ...[h, ...sh.rows.map(r => String(r[i] == null ? '' : r[i]))].map(v => Math.min(60, v.length + 2)))) }));
    X.utils.book_append_sheet(wb, ws, (sh.name || 'Sheet1').slice(0, 31));
    if (sh.note) { const wn = X.utils.aoa_to_sheet(sh.note); wn['!cols'] = [{ wch: 110 }]; X.utils.book_append_sheet(wb, wn, 'Read me'); }
  }
  X.writeFile(wb, filename);
}
export function downloadCsv(filename, csvText) { download(new Blob([csvText], { type: 'text/csv;charset=utf-8' }), filename); }
export function downloadJson(filename, obj) { download(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename); }

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove(); return ok;
  }
}

/* Read .xlsx/.xls/.csv into [{header: value}] using the first row as headers. */
export async function parseSheetFile(file) {
  const buf = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    const text = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
    const rows = parseCsv(text); if (!rows.length) return [];
    const head = rows[0].map(h => String(h).trim());
    return rows.slice(1).filter(r => r.some(c => String(c).trim())).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]])));
  }
  const X = await loadXlsx();
  const wb = X.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames.find(n => !/instruction|read me/i.test(n)) || wb.SheetNames[0]];
  return X.utils.sheet_to_json(ws, { defval: '' });
}
export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/* Map a row of arbitrary headers onto the product model by fuzzy header names. */
const HEADER_MAP = [
  ['sku', /^(seller )?sku( id)?$|^style code|^item_sku$|^seller sku/i], ['productType', /product ?(type|name)|^item_name$|^title$|^product title$|^name$/i], ['brand', /^brand/i], ['category', /^category$|^product category/i], ['subcategory', /sub ?category/i],
  ['description', /description/i], ['keyFeatures', /key features|bullet|highlights|key highlights/i], ['keywords', /keyword|search tags|generic_keywords|tags/i], ['hsn', /^hsn/i], ['gst', /gst|tax %|tax_rate/i], ['colour', /colou?r/i], ['size', /^size/i], ['material', /material|fabric/i],
  ['mrp', /^mrp|list_price|compare at/i], ['sellingPrice', /selling price|standard_price|your selling|^price$|supplier price|meesho price/i], ['stock', /^stock|quantity|inventory/i], ['weightG', /weight \(g\)|weight \(gm\)|product weight|^weight$|item_package_weight/i],
  ['lengthCm', /length/i], ['breadthCm', /breadth|width/i], ['heightCm', /height/i], ['countryOfOrigin', /country/i], ['manufacturerName', /manufacturer( name| details)?$/i], ['manufacturerAddress', /manufacturer address/i], ['warranty', /warranty/i], ['gtin', /ean|gtin|upc|external_product_id$/i], ['model', /model/i],
];
export function rowToProduct(row) {
  const p = { images: [], keyFeatures: [], keywords: [] };
  for (const [h, v] of Object.entries(row)) {
    const hv = String(h).trim(); if (!hv) continue;
    if (/image|photo|picture|img/i.test(hv)) { const u = String(v).trim(); if (/^https?:\/\//.test(u)) p.images.push({ url: u, alt: '' }); continue; }
    const hit = HEADER_MAP.find(([, re]) => re.test(hv)); if (!hit) continue;
    const key = hit[0];
    if (key === 'keyFeatures') p.keyFeatures.push(...String(v).split(/\s*[|\n]\s*/).filter(Boolean));
    else if (key === 'keywords') p.keywords.push(...String(v).split(/\s*[,|\n]\s*/).filter(Boolean));
    else if (key === 'description' && !p.notes) p.notes = String(v).trim().slice(0, 600);
    else if (!(key in p) || !p[key]) p[key] = typeof v === 'string' ? v.trim() : v;
  }
  return p;
}
