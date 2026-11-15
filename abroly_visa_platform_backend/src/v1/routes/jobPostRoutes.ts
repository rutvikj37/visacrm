import express from 'express';
import { requireAddon } from "../../services/saas"
import JobPostController from '../controller/JobPostController';
import { validateAgent, validateGeneral } from '../../middleware/authMiddleware';

const jobPostRoutes = express.Router();

// to check the agent can job post or not
jobPostRoutes.route('/can_post').get(validateAgent,requireAddon("jobs"), JobPostController.canJobPost);

// agent related routes
jobPostRoutes.route('/create').post(validateAgent,requireAddon("jobs"), JobPostController.createJobPost);
jobPostRoutes.route('/delete').post(validateAgent,requireAddon("jobs"), JobPostController.deleteJobPost);
jobPostRoutes.route('/update').post(validateAgent,requireAddon("jobs"), JobPostController.updateJobPost);
jobPostRoutes.route('/change_status').post(validateAgent,requireAddon("jobs"), JobPostController.changeStatus);
jobPostRoutes.route('/created_list/:status').get(validateAgent,requireAddon("jobs"), JobPostController.getAgentJobPosts);
jobPostRoutes.route('/applicants').post(validateAgent,requireAddon("jobs"), JobPostController.applicants);

// user related routes
jobPostRoutes.route('/filter').post(JobPostController.filterJobPosts);
jobPostRoutes.route('/details').post(JobPostController.detailJobPost);
jobPostRoutes.route('/is_applied').post(validateGeneral, JobPostController.isApplied);
jobPostRoutes.route('/apply').post(validateGeneral, JobPostController.apply);
jobPostRoutes.route('/history').post(validateGeneral, JobPostController.historyJobPost);


export default jobPostRoutes;
