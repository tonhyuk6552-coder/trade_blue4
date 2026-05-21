import { Router, type IRouter } from "express";
import chartRouter from "./chart";
import healthRouter from "./health";
import priceRouter from "./price";
import syncRouter from "./sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use(syncRouter);
router.use(priceRouter);
router.use(chartRouter);

export default router;
