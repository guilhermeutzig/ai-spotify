import { render } from "preact";
import { App } from "./app";
import "./styles/global.css";

const rootElement = document.getElementById("root")!;
render(<App />, rootElement);
