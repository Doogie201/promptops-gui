"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalPolicy = void 0;
exports.GlobalPolicy = {
    whitelist: [
        "/Users/marcussmith/Projects/promptops-gui/",
        "docs/backlog/",
        "docs/sprints/README.md",
        "docs/sprints/S01/",
        "/tmp/"
    ],
    budgets: {
        maxNetNewLines: 120,
        maxTotalLines: 1200,
        maxFunctionLength: 80,
        maxNewHooks: 1,
        maxNewUseEffect: 1,
    }
};
