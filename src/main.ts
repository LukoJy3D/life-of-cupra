import { loadCars } from "./data";
import { compute, defaultWhatIf } from "./model/compute";
import { destroyCharts, drawCharts } from "./ui/charts";
import { renderPage } from "./ui/render";
import "./style.css";

const cars = loadCars();
const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("#app missing");

const data = cars[0];
if (!data) throw new Error("No cars in data/cars/");

const model = compute(data, defaultWhatIf(data));
destroyCharts();
renderPage(root, data, model);
drawCharts(model, data);
