
import express from 'express'
export interface IUser {
    user: {
        uuid: string,
        email: string,
        role: string,
        id?: number,
        agent_id: number,
        agent_uuid: string
    }
}

interface RequestWithUser extends express.Request {
    user?: IUser;
    uuid?: string;
    id?: number
} // Explicitly extend 'express.Request' with the 'user' property

export const userAttributes = ["uuid", "username", "email", "description", "country_code", "phone_number", "profile_image", "access_profile", "phone"]
export const postAttributes = ["uuid", "title", "description", "createdAt"]

export { RequestWithUser }