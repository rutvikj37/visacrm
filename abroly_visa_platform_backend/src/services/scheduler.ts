import { backfillBranches } from "./branches";
import { pullAllIndiamart } from "./indiamart";
import { documentsPendingReminders, feeDueReminders } from "./messaging";
import { paymentFailureFollowups } from "./saasFollowups";
import { monthlyOwnerSummaries } from "./ownerSummary";
import { dailyDigest, followUpReminders, ruleReminders, stepDueReminders, subscriptionReminders } from "./notifications";
import { recordSchedulerHeartbeat } from "./platformMonitoring";

/**
 * Simple in-process scheduler. Started by one cluster worker only (see server.ts),
 * so each job runs once per interval across the whole app.
 */
const INDIAMART_INTERVAL_MS = 10 * 60 * 1000;

let started = false;
let indiamartRunning = false;

const runIndiamart = async () => {
    if (indiamartRunning) return;
    indiamartRunning = true;
    const t0 = Date.now();
    try {
        await pullAllIndiamart();
        await recordSchedulerHeartbeat("indiamart_pull", { ok: true, durationMs: Date.now() - t0 });
    } catch (error: any) {
        console.error("IndiaMART scheduled pull failed", error);
        await recordSchedulerHeartbeat("indiamart_pull", {
            ok: false,
            durationMs: Date.now() - t0,
            error: error?.message || String(error),
        });
    } finally {
        indiamartRunning = false;
    }
};

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
let remindersRunning = false;

const runReminders = async () => {
    if (remindersRunning) return;
    remindersRunning = true;
    const t0 = Date.now();
    try {
        await followUpReminders();
        await stepDueReminders();
        await ruleReminders();
        // messages to students
        await documentsPendingReminders();
        await feeDueReminders();
        await dailyDigest();
        await subscriptionReminders();
        await paymentFailureFollowups();
        await monthlyOwnerSummaries();
        await recordSchedulerHeartbeat("reminders_digest", { ok: true, durationMs: Date.now() - t0 });
    } catch (error: any) {
        console.error("Reminder job failed", error);
        await recordSchedulerHeartbeat("reminders_digest", {
            ok: false,
            durationMs: Date.now() - t0,
            error: error?.message || String(error),
        });
    } finally {
        remindersRunning = false;
    }
};

export const startScheduler = () => {
    if (started || process.env.DISABLE_SCHEDULER === "true") return;
    started = true;
    console.log("⏰ Scheduler started (IndiaMART every 10 min, reminders every 5 min)");
    setTimeout(runIndiamart, 60 * 1000);
    setInterval(runIndiamart, INDIAMART_INTERVAL_MS);
    // follow-up reminders, morning digest, trial / plan ending reminders
    setTimeout(runReminders, 30 * 1000);
    // work created before branches carried leads / cases takes the branch of the person handling it
    setTimeout(() => {
        const t0 = Date.now();
        backfillBranches()
            .then(() => recordSchedulerHeartbeat("branch_backfill", { ok: true, durationMs: Date.now() - t0 }))
            .catch((e) => {
                console.error("branch backfill failed", e);
                return recordSchedulerHeartbeat("branch_backfill", {
                    ok: false,
                    durationMs: Date.now() - t0,
                    error: e?.message || String(e),
                });
            });
    }, 20 * 1000);
    setInterval(runReminders, REMINDER_INTERVAL_MS);
};
