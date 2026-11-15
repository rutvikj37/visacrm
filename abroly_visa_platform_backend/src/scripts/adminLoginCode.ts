import dotenv from "dotenv";
dotenv.config();

/**
 * Create the platform admin (if missing) and give them a new fixed 6-digit login code.
 *   npm run admin:code -- 9876543210 "Your Name"
 * The admin logs in at the admin panel with this mobile number + code. Run it again for a new code
 * (the old one stops working). The code is stored hashed and only printed here.
 */
const main = async () => {
    const phone = String(process.argv[2] || "").replace(/\D/g, "");
    const name = String(process.argv[3] || "Platform Admin").trim().slice(0, 100);
    if (phone.length !== 10) {
        console.error('Usage: npm run admin:code -- <10-digit mobile> ["Name"]');
        process.exit(1);
    }
    const sequelize = (await import("../config/dbconfig")).default;
    await sequelize.authenticate();
    const Admin = (await import("../model/Admin")).default as any;
    const { setAdminLoginCode } = await import("../services/agencyLogin");

    let admin: any = await Admin.findOne({ where: { phone_number: phone, country_code: "+91" } });
    if (!admin) {
        admin = await Admin.create({ username: name, phone_number: phone, country_code: "+91", user_type: "admin" });
        console.log(`Created platform admin ${name} (+91 ${phone}).`);
    }
    const code = await setAdminLoginCode(admin.dataValues.id);
    console.log(`\nAdmin login: +91 ${phone}   code ${code}\n(keep it private - run this again any time for a new code)`);
    await sequelize.close();
};

main().catch((e) => { console.error("Failed:", e?.message || e); process.exit(1); });
