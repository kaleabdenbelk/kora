var __awaiter =
  (this && this.__awaiter) ||
  ((thisArg, _arguments, P, generator) => {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P((resolve) => {
            resolve(value);
          });
    }
    return new (P || (P = Promise))((resolve, reject) => {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  });
var __generator =
  (this && this.__generator) ||
  ((thisArg, body) => {
    var _ = {
      label: 0,
      sent: () => {
        if (t[0] & 1) throw t[1];
        return t[1];
      },
      trys: [],
      ops: [],
    };
    var f;
    var y;
    var t;
    var g = Object.create(
      (typeof Iterator === "function" ? Iterator : Object).prototype,
    );
    return (
      (g.next = verb(0)),
      (g.throw = verb(1)),
      (g.return = verb(2)),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return (v) => step([n, v]);
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y.return
                  : op[0]
                    ? y.throw || ((t = y.return) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  });
var __importDefault =
  (this && this.__importDefault) ||
  ((mod) => (mod?.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanService = void 0;
var db_1 = __importDefault(require("@kora/db"));
var PlanService = /** @class */ (() => {
  function PlanService() {}
  /**
   * Generates a workout plan based on the user's onboarding data.
   */
  PlanService.prototype.generatePlan = function (userId) {
    return __awaiter(this, void 0, void 0, function () {
      var profile;
      var existingPlan;
      var selection;
      var program;

      return __generator(this, (_a) => {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              db_1.default.onboarding.findUnique({
                where: { userId: userId },
              }),
            ];
          case 1:
            profile = _a.sent();
            if (
              !profile ||
              !profile.goal ||
              !profile.trainingLevel ||
              !profile.trainingDaysPerWeek
            ) {
              throw new Error("Onboarding incomplete");
            }
            return [
              4 /*yield*/,
              db_1.default.userPlan.findFirst({
                where: { userId: userId },
              }),
            ];
          case 2:
            existingPlan = _a.sent();
            if (!existingPlan) return [3 /*break*/, 4];
            console.log(
              "[PlanService] Generating a fresh plan. Deleting previous plan: ".concat(
                existingPlan.id,
              ),
            );
            return [
              4 /*yield*/,
              db_1.default.userPlan.delete({ where: { id: existingPlan.id } }),
            ];
          case 3:
            _a.sent();
            _a.label = 4;
          case 4:
            return [
              4 /*yield*/,
              db_1.default.programSelection.findUnique({
                where: {
                  goal_level_daysPerWeek_gender: {
                    goal: profile.goal,
                    level: profile.trainingLevel,
                    daysPerWeek: profile.trainingDaysPerWeek,
                    gender: profile.gender,
                  },
                },
                include: {
                  program: {
                    include: {
                      phases: {
                        include: {
                          workouts: {
                            include: {
                              exercises: {
                                include: {
                                  exercise: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              }),
            ];
          case 5:
            selection = _a.sent();
            if (!selection) {
              console.error("[PlanService] No matching program found for:", {
                goal: profile.goal,
                level: profile.trainingLevel,
                days: profile.trainingDaysPerWeek,
                gender: profile.gender,
              });
              throw new Error(
                "No matching program template found for your profile.",
              );
            }
            console.log(
              "[PlanService] Program found: ".concat(
                selection.program.name,
                ". Creating UserPlan...",
              ),
            );
            program = selection.program;
            return [
              4 /*yield*/,
              db_1.default.$transaction((tx) =>
                __awaiter(this, void 0, void 0, function () {
                  var startDate;
                  var endDate;
                  var weeks;
                  var jsonCurrentWeek;
                  var _i;
                  var _a;
                  var _phase;
                  var _w;
                  var _weekNumber;
                  var sessions;
                  var planJson;
                  var userPlan;
                  var sessionData;
                  var currentWeek;
                  var _b;
                  var _c;
                  var phase;
                  var w;
                  var weekNumber;
                  var _d;
                  var _e;
                  var workoutTemplate;
                  return __generator(this, (_f) => {
                    switch (_f.label) {
                      case 0:
                        console.log("[PlanService] Starting transaction...");
                        startDate = new Date();
                        endDate = new Date(startDate);
                        endDate.setDate(
                          startDate.getDate() + program.durationWeeks * 7,
                        );
                        weeks = [];
                        jsonCurrentWeek = 1;
                        for (
                          _i = 0, _a = program.phases;
                          _i < _a.length;
                          _i++
                        ) {
                          phase = _a[_i];
                          for (w = 0; w < phase.durationWeeks; w++) {
                            weekNumber = jsonCurrentWeek + w;
                            sessions = phase.workouts.map((wt) => ({
                              dayNumber: wt.dayNumber,
                              name: wt.name,
                              rest: false,
                              exercises: wt.exercises.map((et) => ({
                                id: et.exercise.id,
                                exerciseId: et.exercise.id,
                                name: et.exercise.name,
                                gifUrl: et.exercise.gifUrl || null,
                                sets: et.sets,
                                reps: et.reps,
                                intensity: et.intensity,
                                restTime: et.restTime,
                              })),
                            }));
                            weeks.push({
                              weekNumber: weekNumber,
                              sessions: sessions,
                            });
                          }
                          jsonCurrentWeek += phase.durationWeeks;
                        }
                        planJson = {
                          programName: program.name,
                          weeks: weeks,
                        };
                        return [
                          4 /*yield*/,
                          tx.userPlan.create({
                            data: {
                              userId: userId,
                              programId: program.id,
                              startDate: startDate,
                              endDate: endDate,
                              planJson: planJson,
                            },
                          }),
                        ];
                      case 1:
                        userPlan = _f.sent();
                        sessionData = [];
                        currentWeek = 1;
                        for (
                          _b = 0, _c = program.phases;
                          _b < _c.length;
                          _b++
                        ) {
                          phase = _c[_b];
                          for (w = 0; w < phase.durationWeeks; w++) {
                            weekNumber = currentWeek + w;
                            for (
                              _d = 0, _e = phase.workouts;
                              _d < _e.length;
                              _d++
                            ) {
                              workoutTemplate = _e[_d];
                              sessionData.push({
                                userId: userId,
                                planId: userPlan.id,
                                dayNumber: workoutTemplate.dayNumber,
                                week: weekNumber,
                                planned: {
                                  name: workoutTemplate.name,
                                  exercises: workoutTemplate.exercises.map(
                                    (et) => ({
                                      exerciseId: et.exerciseId,
                                      name: et.exercise.name,
                                      sets: et.sets,
                                      reps: et.reps,
                                      intensity: et.intensity,
                                      restTime: et.restTime,
                                    }),
                                  ),
                                },
                              });
                            }
                          }
                          currentWeek += phase.durationWeeks;
                        }
                        return [
                          4 /*yield*/,
                          tx.userSession.createMany({
                            data: sessionData,
                          }),
                        ];
                      case 2:
                        _f.sent();
                        return [2 /*return*/, userPlan];
                    }
                  });
                }),
              ),
            ];
          case 6:
            // 3. Create the UserPlan and its sessions in a transaction
            return [2 /*return*/, _a.sent()];
        }
      });
    });
  };
  PlanService.prototype.getActivePlan = function (userId) {
    return __awaiter(this, void 0, void 0, function () {
      var plan;
      return __generator(this, (_a) => {
        switch (_a.label) {
          case 0:
            console.log(
              "[PlanService] Getting active plan for ".concat(userId, "..."),
            );
            return [
              4 /*yield*/,
              db_1.default.userPlan.findFirst({
                where: { userId: userId },
                orderBy: { createdAt: "desc" },
                include: {
                  sessions: {
                    orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
                  },
                },
              }),
            ];
          case 1:
            plan = _a.sent();
            console.log("[PlanService] Plan found: ".concat(!!plan));
            return [2 /*return*/, plan];
        }
      });
    });
  };
  return PlanService;
})();
exports.PlanService = PlanService;
