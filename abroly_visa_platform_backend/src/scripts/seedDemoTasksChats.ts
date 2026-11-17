/**
 * Additive seed: AgencyTask board + PortalChatMessage threads for the existing
 * demo agency "Global Pathways Overseas".
 *
 *   npm run demo:seed:tasks-chats
 *
 * Does NOT wipe the agency or change login codes. Safe to re-run: removes only
 * tasks/portal chats previously tagged for this demo agency (or all of them for
 * that agency when DEMO_TASKS_CHATS_REPLACE=1, the default).
 *
 * Target agency: DEMO_OWNER_PHONE (default 9000000201) / app_name match.
 */
import dotenv from "dotenv";
dotenv.config();

import sequelize from "../config/dbconfig";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysFromNow = (d: number, h = 10, m = 0) => {
    const x = new Date(now.getTime() + d * DAY);
    x.setHours(h, m, 0, 0);
    return x;
};

const OWNER_PHONE = process.env.DEMO_OWNER_PHONE || "9000000201";
const REPLACE = process.env.DEMO_TASKS_CHATS_REPLACE !== "0";

type TaskSpec = {
    title: string;
    description?: string;
    status: "todo" | "in_progress" | "done";
    priority: "low" | "normal" | "high";
    assignee: string;
    createdBy?: string;
    dueDays?: number | null;
    related?: "lead" | "case" | "none";
    relatedName?: string;
    completedDaysAgo?: number;
    createdDaysAgo?: number;
};

type ChatTurn = {
    from: "student" | "agent";
    body: string;
    minsAgo: number;
    read?: boolean;
};

type ChatSpec = {
    studentPhone: string;
    agentName: string;
    messages: ChatTurn[];
};

const TASKS: TaskSpec[] = [
    {
        title: "Call Krish Malhotra — Canada MS enquiry",
        description: "Facebook lead. Confirm IELTS status and Sep intake preference.",
        status: "todo",
        priority: "high",
        assignee: "Neha Patel",
        dueDays: 0,
        related: "lead",
        relatedName: "Krish Malhotra",
        createdDaysAgo: 0,
    },
    {
        title: "Share NZ work-rights summary with Tara Kulkarni",
        description: "Follow up after yesterday's WhatsApp. Send course shortlist.",
        status: "todo",
        priority: "normal",
        assignee: "Arjun Desai",
        dueDays: 1,
        related: "lead",
        relatedName: "Tara Kulkarni",
        createdDaysAgo: 1,
    },
    {
        title: "PR points table for Shaurya Rana",
        description: "Civil engineering skilled list + Deakin / UNSW options.",
        status: "todo",
        priority: "normal",
        assignee: "Neha Patel",
        dueDays: 0,
        related: "lead",
        relatedName: "Shaurya Rana",
        createdDaysAgo: 2,
    },
    {
        title: "Loan docs checklist for Zara Sheikh",
        description: "Credila + Avanse list; collect ITRs and bank statements.",
        status: "todo",
        priority: "high",
        assignee: "Rohan Mehta",
        dueDays: 2,
        related: "lead",
        relatedName: "Zara Sheikh",
        createdDaysAgo: 1,
    },
    {
        title: "Review Saanvi Nair uploaded documents",
        description: "Passport + 10th/12th received. Degree marksheet pending.",
        status: "in_progress",
        priority: "high",
        assignee: "Kavya Iyer",
        createdBy: "Neha Patel",
        dueDays: 1,
        related: "case",
        relatedName: "Saanvi Nair",
        createdDaysAgo: 1,
    },
    {
        title: "Prepare Kabir Mehta biometrics briefing",
        description: "VFS Ahmedabad — passport, appointment letter, CoE checklist.",
        status: "in_progress",
        priority: "high",
        assignee: "Arjun Desai",
        dueDays: 2,
        related: "case",
        relatedName: "Kabir Mehta",
        createdDaysAgo: 2,
    },
    {
        title: "GIC & funds call with Vihaan Joshi parents",
        description: "Explain GIC amount, SDS vs non-SDS, and payment timeline.",
        status: "in_progress",
        priority: "normal",
        assignee: "Neha Patel",
        dueDays: 3,
        related: "case",
        relatedName: "Vihaan Joshi",
        createdDaysAgo: 3,
    },
    {
        title: "SOP first draft — Ishita Trivedi (ASU)",
        description: "MS CS SOP; include research interest and GRE context.",
        status: "in_progress",
        priority: "normal",
        assignee: "Rohan Mehta",
        dueDays: 4,
        related: "case",
        relatedName: "Ishita Trivedi",
        createdDaysAgo: 4,
    },
    {
        title: "Chase Ananya Rao overdue fee balance",
        description: "Germany package half paid. Send portal payment link.",
        status: "todo",
        priority: "high",
        assignee: "Sameer Khan",
        createdBy: "Priya Sharma",
        dueDays: -1,
        related: "case",
        relatedName: "Ananya Rao",
        createdDaysAgo: 5,
    },
    {
        title: "Book Aarav Shah pre-departure briefing",
        description: "Friday 5 pm Ahmedabad office — confirm attendance.",
        status: "todo",
        priority: "normal",
        assignee: "Neha Patel",
        dueDays: 4,
        related: "case",
        relatedName: "Aarav Shah",
        createdDaysAgo: 2,
    },
    {
        title: "Update branch weekly pipeline slide",
        description: "Ahmedabad / Surat / Vadodara open leads + cases for Monday standup.",
        status: "todo",
        priority: "low",
        assignee: "Priya Sharma",
        dueDays: 5,
        related: "none",
        createdDaysAgo: 1,
    },
    {
        title: "Order forex cards for July departures",
        description: "Coordinate with travel desk for approved students.",
        status: "todo",
        priority: "low",
        assignee: "Sameer Khan",
        dueDays: 7,
        related: "none",
        createdDaysAgo: 0,
    },
    {
        title: "File Aarav Shah Canada visa — completed",
        description: "SDS file submitted; study permit approved.",
        status: "done",
        priority: "high",
        assignee: "Neha Patel",
        dueDays: -10,
        related: "case",
        relatedName: "Aarav Shah",
        completedDaysAgo: 8,
        createdDaysAgo: 45,
    },
    {
        title: "Diya Patel CAS / CAS checklist review",
        description: "UK CAS docs verified before visa appointment.",
        status: "done",
        priority: "normal",
        assignee: "Rohan Mehta",
        dueDays: -12,
        related: "case",
        relatedName: "Diya Patel",
        completedDaysAgo: 10,
        createdDaysAgo: 40,
    },
    {
        title: "Dhruv Chauhan CoE follow-up with Uni of Sydney",
        description: "CoE issued; pre-visa medical booked.",
        status: "done",
        priority: "normal",
        assignee: "Neha Patel",
        dueDays: -20,
        related: "case",
        relatedName: "Dhruv Chauhan",
        completedDaysAgo: 18,
        createdDaysAgo: 50,
    },
    {
        title: "Print marketing spend report (last month)",
        description: "Facebook / Google / Instagram ROI for Priya.",
        status: "done",
        priority: "low",
        assignee: "Sameer Khan",
        createdBy: "Priya Sharma",
        dueDays: -3,
        related: "none",
        completedDaysAgo: 2,
        createdDaysAgo: 7,
    },
];

const CHATS: ChatSpec[] = [
    {
        studentPhone: "9000000301",
        agentName: "Neha Patel",
        messages: [
            { from: "agent", body: "Hi Aarav! Congrats again on the Canada study permit 🎉 When works for the pre-departure briefing?", minsAgo: 3 * 24 * 60, read: true },
            { from: "student", body: "Thank you Neha! Friday evening works for me and my parents.", minsAgo: 3 * 24 * 60 - 40, read: true },
            { from: "agent", body: "Perfect — Friday 5 pm at our Ahmedabad office (Shivalik Shilp). Bring your passport and offer letter.", minsAgo: 3 * 24 * 60 - 55, read: true },
            { from: "student", body: "Will do. Also, do you help with forex / travel card?", minsAgo: 26 * 60, read: true },
            { from: "agent", body: "Yes — Sameer will set that up after the briefing. See you Friday!", minsAgo: 25 * 60, read: true },
            { from: "student", body: "One more thing — can I get a housing shortlist near U of T?", minsAgo: 90, read: false },
        ],
    },
    {
        studentPhone: "9000000303",
        agentName: "Arjun Desai",
        messages: [
            { from: "student", body: "Hi Arjun, I got my biometrics appointment for next Tuesday at VFS Ahmedabad.", minsAgo: 28 * 60, read: true },
            { from: "agent", body: "Great news Kabir! Carry passport, appointment letter and CoE. Arrive 30 mins early.", minsAgo: 27 * 60, read: true },
            { from: "student", body: "Should I also carry bank statements?", minsAgo: 26 * 60, read: true },
            { from: "agent", body: "Not needed for biometrics — just ID docs. I'll send a checklist PDF on WhatsApp too.", minsAgo: 25 * 60, read: true },
            { from: "student", body: "Thanks. Any update on the OSHC start date?", minsAgo: 4 * 60, read: false },
        ],
    },
    {
        studentPhone: "9000000308",
        agentName: "Neha Patel",
        messages: [
            { from: "agent", body: "Hi Saanvi, please upload passport and marksheets in the student portal when you can.", minsAgo: 2 * 24 * 60, read: true },
            { from: "student", body: "Uploaded passport and 10th/12th. Degree marksheet tomorrow after college.", minsAgo: 22 * 60, read: true },
            { from: "agent", body: "Received — Kavya is reviewing them. Once degree is up we'll shortlist Deakin units.", minsAgo: 20 * 60, read: true },
            { from: "student", body: "Should I also book IELTS again or is 7.0 enough for Deakin?", minsAgo: 3 * 60, read: false },
        ],
    },
    {
        studentPhone: "9000000305",
        agentName: "Neha Patel",
        messages: [
            { from: "agent", body: "Hi Vihaan — let's schedule a call with your parents about GIC and proof of funds.", minsAgo: 4 * 24 * 60, read: true },
            { from: "student", body: "Sunday morning is best for them. Can we do 11 am?", minsAgo: 4 * 24 * 60 - 90, read: true },
            { from: "agent", body: "Sunday 11 am works. I'll send a Zoom link and the funds checklist.", minsAgo: 3 * 24 * 60, read: true },
            { from: "student", body: "Got the checklist. Dad asked if education loan counts toward funds.", minsAgo: 12 * 60, read: true },
            { from: "agent", body: "Yes for non-SDS — we'll cover that on the call. See you Sunday!", minsAgo: 11 * 60, read: true },
        ],
    },
    {
        studentPhone: "9000000306",
        agentName: "Rohan Mehta",
        messages: [
            { from: "student", body: "Rohan, ASU asked for an updated SOP by next week. Can you help?", minsAgo: 2 * 24 * 60, read: true },
            { from: "agent", body: "Absolutely. Share your draft and GRE score report — I'll revise by Thursday.", minsAgo: 2 * 24 * 60 - 30, read: true },
            { from: "student", body: "Draft uploaded in the portal under Documents.", minsAgo: 30 * 60, read: true },
            { from: "agent", body: "Got it — reviewing now. I'll ping you here once the first rewrite is ready.", minsAgo: 20 * 60, read: false },
        ],
    },
    {
        studentPhone: "9000000304",
        agentName: "Neha Patel",
        messages: [
            { from: "agent", body: "Ananya — your Germany visa file is lodged. We'll share VFS tracking once available.", minsAgo: 5 * 24 * 60, read: true },
            { from: "student", body: "Thanks! Also reminder that the second fee installment is pending on my side.", minsAgo: 5 * 24 * 60 - 50, read: true },
            { from: "agent", body: "Sameer shared the portal payment link. You can pay UPI from Fees → Pay now.", minsAgo: 4 * 24 * 60, read: true },
            { from: "student", body: "I'll pay tomorrow morning. Any blocked-account update from Fintiba?", minsAgo: 6 * 60, read: false },
        ],
    },
];

/** Seed tasks + portal chats for an existing demo agency. Returns counts. */
export async function seedDemoTasksAndChats(opts?: {
    agencyUuid?: string;
    replace?: boolean;
    closeDb?: boolean;
}) {
    const replace = opts?.replace ?? REPLACE;
    const closeDb = opts?.closeDb ?? false;

    await sequelize.authenticate();
    const ModelInitializer = (await import("../config/modelInitializer")).default;
    const init = ModelInitializer.getInstance();
    if (!init.isModelInitialized()) init.setupAssociationsOnly();

    const Agent = (await import("../model/Agent")).default as any;
    const User = (await import("../model/User")).default as any;
    const CrmLead = (await import("../model/CrmLead")).default as any;
    const AgencyLeads = (await import("../model/AgencyLeads")).default as any;
    const AgencyTask = (await import("../model/AgencyTask")).default as any;
    const PortalChatMessage = (await import("../model/PortalChatMessage")).default as any;

    let owner: any;
    if (opts?.agencyUuid) {
        owner = await Agent.findOne({ where: { uuid: opts.agencyUuid, role: "agent" } });
    } else {
        owner = await Agent.findOne({ where: { phone_number: OWNER_PHONE, role: "agent" } });
    }
    if (!owner) throw new Error(`Demo agency owner not found for phone ${OWNER_PHONE}`);
    const agencyUuid: string = owner.dataValues.uuid;
    const agencyId: number = owner.dataValues.id;
    const appName: string = owner.dataValues.app_name || "";
    if (!/global pathways/i.test(appName)) {
        console.warn(`Warning: owner app_name is "${appName}" (expected Global Pathways Overseas). Continuing with phone match.`);
    }
    console.log(`Agency: ${appName || "(no name)"}  uuid=${agencyUuid}  id=${agencyId}`);

    const team: any[] = await Agent.findAll({
        where: { parent_uuid: agencyUuid },
        attributes: ["id", "username", "phone_number", "role", "team_role"],
    });
    const staffByName: Record<string, number> = { [owner.dataValues.username]: agencyId };
    for (const t of team) staffByName[t.dataValues.username] = t.dataValues.id;
    console.log(`Staff: ${Object.keys(staffByName).join(", ")}`);

    const students: any[] = await User.findAll({
        where: { agency_uuid: agencyUuid },
        attributes: ["id", "username", "phone_number"],
    });
    const studentByPhone: Record<string, { id: number; name: string }> = {};
    for (const s of students) {
        studentByPhone[String(s.dataValues.phone_number)] = {
            id: s.dataValues.id,
            name: s.dataValues.username,
        };
    }

    const leads: any[] = await CrmLead.findAll({
        where: { agency_uuid: agencyUuid },
        attributes: ["id", "uuid", "name", "phone_number"],
    });
    const leadByName: Record<string, { id: number; uuid: string }> = {};
    for (const l of leads) {
        leadByName[l.dataValues.name] = { id: l.dataValues.id, uuid: l.dataValues.uuid };
    }

    const cases: any[] = await AgencyLeads.findAll({
        where: { agent_uuid: agencyUuid },
        attributes: ["id", "user_id", "assign_id", "status"],
    });
    const caseByStudentId: Record<number, number> = {};
    for (const c of cases) {
        const uid = Number(c.dataValues.user_id);
        if (uid) caseByStudentId[uid] = c.dataValues.id;
    }
    const caseByStudentName: Record<string, number> = {};
    for (const s of students) {
        const cid = caseByStudentId[s.dataValues.id];
        if (cid) caseByStudentName[s.dataValues.username] = cid;
    }

    if (replace) {
        const removedTasks = await AgencyTask.destroy({ where: { agency_uuid: agencyUuid }, force: true });
        const removedChats = await PortalChatMessage.destroy({ where: { agency_uuid: agencyUuid } });
        console.log(`Cleared existing demo tasks/chats for this agency only: ${removedTasks} tasks, ${removedChats} messages.`);
    }

    const setTaskTimes = async (id: number, createdAt: Date, updatedAt: Date, completedAt: Date | null) => {
        if (completedAt) {
            await sequelize.query(
                "UPDATE `agency_tasks` SET createdAt = ?, updatedAt = ?, completed_at = ? WHERE id = ?",
                { replacements: [createdAt, updatedAt, completedAt, id] },
            );
        } else {
            await sequelize.query(
                "UPDATE `agency_tasks` SET createdAt = ?, updatedAt = ? WHERE id = ?",
                { replacements: [createdAt, updatedAt, id] },
            );
        }
    };

    const createdTaskIds: number[] = [];
    for (const t of TASKS) {
        const assignee_id = staffByName[t.assignee];
        if (!assignee_id) {
            console.warn(`Skip task "${t.title}": assignee ${t.assignee} not found`);
            continue;
        }
        const created_by = staffByName[t.createdBy || "Priya Sharma"] || agencyId;
        let related_type: "none" | "lead" | "case" = t.related || "none";
        let related_id: string | null = null;
        if (related_type === "lead" && t.relatedName) {
            const lead = leadByName[t.relatedName];
            if (!lead) {
                console.warn(`Task "${t.title}": lead ${t.relatedName} missing — storing without link`);
                related_type = "none";
            } else {
                related_id = lead.uuid;
            }
        }
        if (related_type === "case" && t.relatedName) {
            const caseId = caseByStudentName[t.relatedName];
            if (!caseId) {
                console.warn(`Task "${t.title}": case for ${t.relatedName} missing — storing without link`);
                related_type = "none";
            } else {
                related_id = String(caseId);
            }
        }

        const due_at = t.dueDays === null || t.dueDays === undefined ? null : daysFromNow(t.dueDays, 17, 0);
        const completed_at =
            t.status === "done"
                ? daysFromNow(-(t.completedDaysAgo ?? 1), 16, 0)
                : null;
        const createdAt = daysFromNow(-(t.createdDaysAgo ?? 1), 11, 0);
        const updatedAt = completed_at || (t.status === "in_progress" ? daysFromNow(-Math.min(1, t.createdDaysAgo ?? 1), 14, 0) : createdAt);

        const row: any = await AgencyTask.create({
            agency_uuid: agencyUuid,
            created_by,
            assignee_id,
            title: t.title,
            description: t.description || null,
            status: t.status,
            priority: t.priority,
            due_at,
            related_type,
            related_id,
            completed_at,
        });
        await setTaskTimes(row.dataValues.id, createdAt, updatedAt, completed_at);
        createdTaskIds.push(row.dataValues.id);
    }

    const setChatTime = async (id: number, at: Date) => {
        await sequelize.query("UPDATE `portal_chat_messages` SET createdAt = ? WHERE id = ?", {
            replacements: [at, id],
        });
    };

    let messageCount = 0;
    const chatSummaries: { student: string; phone: string; studentId: number; messages: number; unreadForAgent: number }[] = [];
    for (const chat of CHATS) {
        const student = studentByPhone[chat.studentPhone];
        if (!student) {
            console.warn(`Skip chat for phone ${chat.studentPhone}: student not found`);
            continue;
        }
        const agentId = staffByName[chat.agentName] || agencyId;
        let unreadForAgent = 0;
        for (const m of chat.messages) {
            const at = new Date(now.getTime() - m.minsAgo * 60 * 1000);
            const read_at = m.read === false ? null : new Date(at.getTime() + 5 * 60 * 1000);
            if (m.from === "student" && m.read === false) unreadForAgent += 1;
            const row: any = await PortalChatMessage.create({
                agency_uuid: agencyUuid,
                student_id: student.id,
                sender_type: m.from,
                sender_id: m.from === "student" ? student.id : agentId,
                body: m.body,
                read_at,
            });
            await setChatTime(row.dataValues.id, at);
            messageCount += 1;
        }
        chatSummaries.push({
            student: student.name,
            phone: chat.studentPhone,
            studentId: student.id,
            messages: chat.messages.length,
            unreadForAgent,
        });
    }

    const taskCounts = {
        todo: await AgencyTask.count({ where: { agency_uuid: agencyUuid, status: "todo" } }),
        in_progress: await AgencyTask.count({ where: { agency_uuid: agencyUuid, status: "in_progress" } }),
        done: await AgencyTask.count({ where: { agency_uuid: agencyUuid, status: "done" } }),
        total: await AgencyTask.count({ where: { agency_uuid: agencyUuid } }),
    };
    const chatThreadCount = chatSummaries.length;
    const portalTotal = await PortalChatMessage.count({ where: { agency_uuid: agencyUuid } });

    console.log("\n--- Seed complete (this agency only) ---");
    console.log(`Agency UUID: ${agencyUuid}`);
    console.log(`Tasks created: ${createdTaskIds.length} (ids ${createdTaskIds[0]}…${createdTaskIds[createdTaskIds.length - 1]})`);
    console.log(`Task board: ${taskCounts.todo} todo / ${taskCounts.in_progress} in_progress / ${taskCounts.done} done (total ${taskCounts.total})`);
    console.log(`Portal chat threads: ${chatThreadCount}, messages: ${messageCount} (agency total ${portalTotal})`);
    for (const c of chatSummaries) {
        console.log(`  · ${c.student} (+91 ${c.phone}, student_id=${c.studentId}): ${c.messages} msgs, ${c.unreadForAgent} unread for agent`);
    }
    console.log("\nUI:");
    console.log("  Agency Tasks:  https://crm.techxsolutions.io/agency → CRM → Tasks  (/crm/tasks)");
    console.log("  Agency Chats:  https://crm.techxsolutions.io/agency → CRM → Chats  (/crm/chats)");
    console.log("  Student chat:  https://demo.techxsolutions.io (login as Aarav / Kabir / Saanvi etc.)");

    if (closeDb) await sequelize.close();
    return {
        agencyUuid,
        taskIds: createdTaskIds,
        taskCounts,
        chatThreadCount,
        messageCount,
        chatSummaries,
    };
}

const isDirectRun = require.main === module;
if (isDirectRun) {
    seedDemoTasksAndChats({ closeDb: true }).catch(async (e) => {
        console.error("Tasks/chats seed failed:", e?.message || e);
        if (e?.parent?.sqlMessage) console.error("SQL:", e.parent.sqlMessage);
        await sequelize.close().catch(() => {});
        process.exit(1);
    });
}
