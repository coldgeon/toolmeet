/* #1/#4 HTTP ordering fixtures: deliberately replace follow-up selection while
 * retaining production DTO normalization, validation, and confirmation adapter.
 * The actual mock conversation is exercised separately in adapter/DOM tests. */
import fs from 'node:fs';
import path from 'node:path';
export function installLegacyAdapter(window, frontend, feed, {loadCatalog = false} = {}) {
  const {document} = window;
  if (loadCatalog) {
    Object.defineProperty(document, 'currentScript', {configurable:true, value:document.querySelector('script[src$="catalog.js"]')});
    window.eval(fs.readFileSync(path.join(frontend, 'src/catalog.js'), 'utf8'));
    delete document.currentScript;
  }
  window.eval(fs.readFileSync(path.join(frontend, 'src/conversation.js'), 'utf8'));
  const contract = window.ToolmeetConversationContract;
  const production = window.ToolmeetConversation;
  window.ToolmeetConversation = {
    async evaluate(s) {
      const facts = contract.factsFor(s);
      try {
        const response = await window.fetch('/api/brief', {method:'POST', body:JSON.stringify(contract.legacyProfile(s, facts))});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'HTTP failure');
        const catalog = await window.ToolmeetCatalog.list();
        return contract.normalizeBrief(data, s, facts, catalog);
      } catch (error) {return {...contract.errorDto(s, error), facts};}
    },
    confirm: production.confirm,
  };
}
