export async function trelloApi(params: { action: 'list_boards' | 'list_cards' | 'create_card' | 'move_card'; boardId?: string; listId?: string; cardId?: string; name?: string; description?: string }): Promise<string> {
  const key = process.env['TRELLO_API_KEY'];
  const token = process.env['TRELLO_TOKEN'];
  if (!key || !token) throw new Error('TRELLO_API_KEY and TRELLO_TOKEN required');
  const auth = `key=${key}&token=${token}`;
  const base = 'https://api.trello.com/1';

  switch (params.action) {
    case 'list_boards': {
      const res = await fetch(`${base}/members/me/boards?${auth}&fields=name,url`);
      if (!res.ok) throw new Error(`Trello failed: ${res.status}`);
      return res.text();
    }
    case 'list_cards': {
      if (!params.boardId) throw new Error('boardId required');
      const res = await fetch(`${base}/boards/${params.boardId}/cards?${auth}&fields=name,desc,idList,url`);
      if (!res.ok) throw new Error(`Trello failed: ${res.status}`);
      return res.text();
    }
    case 'create_card': {
      if (!params.listId || !params.name) throw new Error('listId and name required');
      const res = await fetch(`${base}/cards?${auth}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idList: params.listId, name: params.name, desc: params.description ?? '' }) });
      if (!res.ok) throw new Error(`Trello failed: ${res.status}`);
      return res.text();
    }
    case 'move_card': {
      if (!params.cardId || !params.listId) throw new Error('cardId and listId required');
      const res = await fetch(`${base}/cards/${params.cardId}?${auth}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idList: params.listId }) });
      if (!res.ok) throw new Error(`Trello failed: ${res.status}`);
      return res.text();
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
