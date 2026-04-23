"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("./packages/db/prisma/generated/client");
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var prisma = new client_1.PrismaClient();
function createMockSession() {
    return __awaiter(this, void 0, void 0, function () {
        var user, plan, session;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🚀 Creating Mock Completed Session...");
                    return [4 /*yield*/, prisma.user.findFirst()];
                case 1:
                    user = _a.sent();
                    if (!user) {
                        console.error("❌ No user found. Please sign in to the app first.");
                        return [2 /*return*/];
                    }
                    console.log("\uD83D\uDC64 Found User: ".concat(user.name, " (ID: ").concat(user.id, ")"));
                    return [4 /*yield*/, prisma.userPlan.findFirst({
                            where: { userId: user.id, isActive: true, isDeleted: false },
                        })];
                case 2:
                    plan = _a.sent();
                    if (!!plan) return [3 /*break*/, 4];
                    console.log("📝 Creating a dummy plan for the user...");
                    return [4 /*yield*/, prisma.userPlan.create({
                            data: {
                                userId: user.id,
                                name: "Mock Growth Plan",
                                startDate: new Date(),
                                isActive: true,
                                source: "CUSTOM",
                                planJson: {},
                            },
                        })];
                case 3:
                    plan = _a.sent();
                    _a.label = 4;
                case 4:
                    console.log("🏋️ Creating a completed session started today...");
                    return [4 /*yield*/, prisma.userSession.create({
                            data: {
                                userId: user.id,
                                planId: plan.id,
                                dayNumber: 1,
                                week: 1,
                                planned: {},
                                startedAt: new Date(Date.now() - 3600000),
                                completedAt: new Date(),
                                completedStatus: true,
                                totalVolumeKg: 5000,
                                totalDurationSeconds: 2700,
                                activeMinutes: 45,
                            },
                        })];
                case 5:
                    session = _a.sent();
                    console.log("📊 Adding exercise logs...");
                    return [4 /*yield*/, prisma.userExerciseLog.create({
                            data: {
                                sessionId: session.id,
                                exerciseId: "1",
                                plannedSets: 3,
                                plannedReps: "5",
                                actualSets: 3,
                                completed: true,
                                weightsPerSet: [100, 100, 100],
                                repsPerSet: [5, 5, 5],
                            },
                        })];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, prisma.userExerciseLog.create({
                            data: {
                                sessionId: session.id,
                                exerciseId: "2",
                                plannedSets: 3,
                                plannedReps: "10",
                                actualSets: 3,
                                completed: true,
                                weightsPerSet: [60, 60, 60],
                                repsPerSet: [10, 10, 10],
                            },
                        })];
                case 7:
                    _a.sent();
                    console.log("\u2705 SUCCESS: Mock session created (ID: ".concat(session.id, ")"));
                    return [2 /*return*/];
            }
        });
    });
}
createMockSession()
    .catch(console.error)
    .finally(function () { return prisma.$disconnect(); });
