"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("../engine/events/schema");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Generate identical events but constructed differently (property order)
const eventA = {
    version: '1.0',
    type: 'USER_ACTION',
    payload: { c: 3, a: 1, b: 2 }
};
const eventB = {
    type: 'USER_ACTION',
    payload: { a: 1, b: 2, c: 3 },
    version: '1.0'
};
const hashA = (0, schema_1.idForEvent)(eventA);
const hashB = (0, schema_1.idForEvent)(eventB);
console.log(`Event A Hash: ${hashA}`);
console.log(`Event B Hash: ${hashB}`);
if (hashA === hashB) {
    console.log('SUCCESS: Events are deterministic and produce identical hashes.');
}
else {
    console.error('FAIL: Non-deterministic event hashes.');
    process.exit(1);
}
// Dump to events.jsonl
const outPath = path.join(__dirname, 'events.jsonl');
fs.writeFileSync(outPath, JSON.stringify({ id: hashA, payload: eventA }) + '\n');
fs.appendFileSync(outPath, JSON.stringify({ id: hashB, payload: eventB }) + '\n');
console.log(`Wrote events to ${outPath}`);
