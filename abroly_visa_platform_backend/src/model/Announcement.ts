import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * Message from the platform admin to agencies (new feature, maintenance, offer ...).
 *   audience  all | trial | paid | plans (plan_ids) | agencies (agency_uuids)
 *   people    owners | everyone (owners and their team)
 * Shown as a banner in the agency panel until dismissed / ends_at, plus a bell notification and optional email.
 */
const Announcement = sequelize.define('Announcement', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    title: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: true },
    level: { type: DataTypes.ENUM("info", "success", "warning"), defaultValue: "info" },
    link_url: { type: DataTypes.STRING(500), allowNull: true },
    link_label: { type: DataTypes.STRING(60), allowNull: true },
    audience: { type: DataTypes.ENUM("all", "trial", "paid", "plans", "agencies"), defaultValue: "all" },
    plan_ids: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("plan_ids") },
    agency_uuids: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("agency_uuids") },
    people: { type: DataTypes.ENUM("owners", "everyone"), defaultValue: "everyone" },
    show_banner: { type: DataTypes.BOOLEAN, defaultValue: true },
    send_email: { type: DataTypes.BOOLEAN, defaultValue: false },
    starts_at: { type: DataTypes.DATE, allowNull: true },
    ends_at: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.ENUM("draft", "published", "ended"), defaultValue: "draft" },
    published_at: { type: DataTypes.DATE, allowNull: true },
    recipients: { type: DataTypes.INTEGER, defaultValue: 0 }, // people notified when published
    created_by_admin: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'announcements',
    timestamps: true,
    paranoid: true,
});

export default Announcement;
