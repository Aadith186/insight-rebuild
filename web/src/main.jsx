import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "./app/context";
import App from "./app/App";
import { RealtimeProvider } from "./app/realtime";
import "./styles.css";
import "./android.css";
import { ANDROID_APP } from "./app/platform";
if (ANDROID_APP) document.documentElement.classList.add("insight-android");
class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <main className="state full-height">
          <h1>Could not display this view</h1>
          <p>Reload Insight to try again.</p>
          <button onClick={() => location.reload()}>Reload</button>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")).render(
  <Boundary>
    <Provider>
      <RealtimeProvider>
        <App />
      </RealtimeProvider>
    </Provider>
  </Boundary>,
);
