// Unified shape vocabulary. The supplied brand logos are separate original PNGs.
export const GLYPHS={
 temperature:'<path d="M14 14V5a3 3 0 0 0-6 0v9a5 5 0 1 0 6 0Z"/><path d="M11 9v9"/>',
 light:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
 motion:'<circle cx="12" cy="6" r="2.2"/><path d="m8 21 2.5-7-2-3.2M16.5 21l-3-6.8 1.5-4.2M7 13l-3 2m11-3 5 2"/>',
 camera:'<rect x="3" y="5" width="12" height="14" rx="2"/><circle cx="9" cy="12" r="3"/><path d="m15 9 6-3v12l-6-3"/>',
 gas:'<path d="M8 3v5a4 4 0 0 1-1.3 3c-1.3 1.2-2.7 2.5-2.7 4.5a8 8 0 0 0 16 0c0-3-2.2-5-4.3-6.8M12 21c2.5-.5 3-2.5 2.5-4.5M10 12l2-3 2 3"/>',
 smoke:'<path d="M5 20h14M7 16c-2-2-1-3 0-5 1-1.4 1-2.5 0-4M12 16c-2-2-1-3 0-5 1-1.4 1-2.5 0-4M17 16c-2-2-1-3 0-5 1-1.4 1-2.5 0-4"/>',
 water:'<path d="M12 2C9 6.5 5.5 10.1 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 15 6.5 12 2Z"/><path d="M9 16a3 3 0 0 0 3 2"/>',
 switch:'<rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="9" cy="12" r="3"/>'
};
export const icon=(type,color='currentColor',size=18)=>`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[type]||GLYPHS.switch}</svg>`;
export const escapeHTML=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
