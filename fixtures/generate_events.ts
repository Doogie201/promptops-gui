import { BaseEvent, idForEvent } from '../engine/events/schema';
import * as fs from 'fs';
import * as path from 'path';

// Generate identical events but constructed differently (property order)
const eventA: BaseEvent = {
  version: '1.0',
  type: 'USER_ACTION',
  payload: { c: 3, a: 1, b: 2 }
};

const eventB: BaseEvent = {
  type: 'USER_ACTION',
  payload: { a: 1, b: 2, c: 3 },
  version: '1.0'
};

const hashA = idForEvent(eventA);
const hashB = idForEvent(eventB);

console.log(`Event A Hash: ${hashA}`);
console.log(`Event B Hash: ${hashB}`);

if (hashA === hashB) {
  console.log('SUCCESS: Events are deterministic and produce identical hashes.');
} else {
  console.error('FAIL: Non-deterministic event hashes.');
  process.exit(1);
}

// Dump to events.jsonl
const outPath = path.join(__dirname, 'events.jsonl');
fs.writeFileSync(outPath, JSON.stringify({id: hashA, payload: eventA}) + '\n');
fs.appendFileSync(outPath, JSON.stringify({id: hashB, payload: eventB}) + '\n');
console.log(`Wrote events to ${outPath}`);
