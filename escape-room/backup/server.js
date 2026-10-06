require("dotenv").config();
const express = require("express"),
  path = require("path"),
  cookies = require("cookie-parser");
const app = express();
app.use(express.json());
app.use(cookies());
app.use("/api", require("./routes"));
app.use(express.static(path.join(__dirname, "frontend"))); // front e API na mesma origem
app.listen(process.env.PORT || 3000, () =>
  console.log("Escape Room em http://localhost:" + (process.env.PORT || 3000)),
);
