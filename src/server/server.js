require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const PORT = process.env.AUDIO_SOURCE_PORT;
const app = express();

app.use(cors());
app.use(express.json());
app.set("json spaces", 2);
app.use(morgan("dev"));

app.use("/", require("./routes/stream.route"));
app.use("/", require("./routes/info.route"));

app.use((req, res) => res.status(404).json({
    success: false,
    error: "Endpoint not found"
}));

app.listen(PORT, () => console.log(`🎧 EyeDaemon running on :${PORT}`));
