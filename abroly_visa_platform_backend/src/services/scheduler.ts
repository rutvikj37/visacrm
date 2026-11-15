import { backfillBranches } from "./branches";
import { pullAllIndiamart } from "./indiamart";
import { documentsPendingReminders, feeDueReminders } from "./messaging";
import { paymentFailureFollowups } from "./saasFollowups";
import { monthlyOwnerSummaries } from "./ownerSummary";
import { dailyDigest, followUpReminders, ruleReminders, stepDueReminders, subscriptionReminders } from "./notifications";

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
    try {
        await pullAllIndiamart();
    } catch (error) {
        console.error("IndiaMART scheduled pull failed", error);
    } finally {
        indiamartRunning = false;
    }
};

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
let remindersRunning = false;

const runReminders = async () => {
    if (remindersRunning) return;
    remindersRunning = true;
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
    } catch (error) {
        console.error("Reminder job failed", error);
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
    setTimeout(() => { backfillBranches().catch((e) => console.error("branch backfill failed", e)); }, 20 * 1000);
    setInterval(runReminders, REMINDER_INTERVAL_MS);
};
