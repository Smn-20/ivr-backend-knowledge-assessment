require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const mongoose = require("mongoose");
const moment = require("moment");
const app = express();
const port = 3005;


// Middleware to parse incoming request bodies
app.use(express.urlencoded({ extended: true }));

// Load Twilio credentials from environment variables
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_TO, MONGO_URI } =
  process.env;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err));


// Define Call Schema
const callSchema = new mongoose.Schema({
  callSid: String,
  phoneNumber: String,
  startTime: Date,
  endTime: Date,
  duration: Number,
  answers: Object,
});

const Call = mongoose.model("Call", callSchema);


const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Store responses in memory (use database for production)
const userResponses = {};

async function createCall() {
  try {
    const call = await client.calls.create({
      from: TWILIO_FROM,
      to: TWILIO_TO,
      url: "http://10.10.95.100:3005/inbound-call", // Replace with your public URL
      statusCallback: "http://10.10.95.100:3005/call-complete",
      statusCallbackEvent: ["completed"],
      statusCallbackMethod: "POST"
    });

    console.log(`Call initiated: ${call.sid}`);
    return call.sid;
  } catch (error) {
    console.error("Error creating call:", error.message);
    throw error;
  }
}

app.get("/", async (req, res) => {
  try {
    const callSid = await createCall();
    res.send(`<h1>Call initiated! SID: ${callSid}</h1>`);
  } catch {
    res.status(500).send("<h1>Failed to initiate call</h1>");
  }
});

// Start call and ask first question
app.post("/inbound-call", async (req, res) => {
  console.log(req.body.CallSid)
  const callSid = req.body.CallSid;
  console.log(callSid)
  userResponses[callSid] = {}; // Initialize response storage for this call

  await Call.create({
    callSid: callSid,
    phoneNumber: TWILIO_TO,
    startTime: new Date(),
});

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    "This is a call from ChildFund, we would like to Assess knowledge among the youth about sexual reproductive health rights and services, if you would like to participate, press 1 for Yes, press 2 for No."
  );
  twiml.gather({
    numDigits: 1,
    action: "/question1",
    method: "POST",
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

// Handle response to question 1
app.post("/question1", (req, res) => {
  const callSid = req.body.CallSid;
  const digitPressed = req.body.Digits;

  if (digitPressed === "1") {
    userResponses[callSid].participation = "Yes";
    console.log(userResponses);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "What is your age group? Press 1 for 10 to 14. Press 2 for 15 to 19. Press 3 for 20 to 24. Press 4 for 25+."
    );
    twiml.gather({
      numDigits: 1,
      action: "/question2",
      method: "POST",
    });

    res.type("text/xml");
    res.send(twiml.toString());
  } else {
    userResponses[callSid].participation = "No";

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Thank you for your time. Goodbye.");
    twiml.hangup();

    res.type("text/xml");
    res.send(twiml.toString());
  }
});

// Handle response to question 2
app.post("/question2", (req, res) => {
  const callSid = req.body.CallSid;
  const digitPressed = req.body.Digits;

  const ageGroups = {
    1: "10-14",
    2: "15-19",
    3: "20-24",
    4: "25+",
  };

  userResponses[callSid].ageGroup = ageGroups[digitPressed] || "Unknown";

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    "What is your gender? Press 1 for male. Press 2 for female. Press 3 for other."
  );
  twiml.gather({
    numDigits: 1,
    action: "/question3",
    method: "POST",
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

// Handle response to question 3
app.post("/question3", (req, res) => {
  const callSid = req.body.CallSid;
  const digitPressed = req.body.Digits;

  const genderList = {
    1: "Male",
    2: "Female",
    3: "Other",
  };

  userResponses[callSid].gender = genderList[digitPressed];

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    "What is your level of education? Press 1 for No formal education, Press 2 for Primary school, Press 3 for Secondary school, Press 4 for University."
  );
  twiml.gather({
    numDigits: 1,
    action: "/question4",
    method: "POST",
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

app.post("/question4", (req, res) => {
  const callSid = req.body.CallSid;
  const digitPressed = req.body.Digits;

  const educationList = {
    1: "No formal education",
    2: "Primary school",
    3: "Secondary school",
    4: "University",
  };

  userResponses[callSid].educationLevel =
    educationList[digitPressed] || "Unknown";

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    "What is your current living situation? Press 1 for With parents. Press 2 for With a guardian. Press 3 for Living independently. Press 4 for Other."
  );
  twiml.gather({
    numDigits: 1,
    action: "/question5",
    method: "POST",
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

app.post("/question5", (req, res) => {
  const callSid = req.body.CallSid;
  const digitPressed = req.body.Digits;

  const livingSituationList = {
    1: "Living with parents",
    2: "Living with a guardian",
    3: "Living independently",
    4: "Other",
  };

  userResponses[callSid].livingSituation = livingSituationList[digitPressed] || "Unknown";

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    "Do you know where to access SRH services? Press 1 for Yes I know. Press 2 for No I don't know. Press 3 for I have never heard of places for SRH services."
  );
  twiml.gather({
    numDigits: 1,
    action: "/question6",
    method: "POST",
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

app.post("/question6", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const options = {
      1: "Yes, I know",
      2: "No, I don't know",
      3: "I have never heard of places for SRH services"
    };
  
    userResponses[callSid].accessToHealth = options[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say(
        "Have you ever visited an SRH center for services like consultation, counseling or STD testing? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
        numDigits: 1,
        action: "/question7",
        method: "POST",
    });
   
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question7", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes",
        2: "No"
    };
  
    userResponses[callSid].visited = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "What barriers prevent you from accessing SRH services? (Select all that apply) Press 1 for Cost. Press 2 for Distance. Press 3 for Fear of discrimination. Press 4 for Lack of knowledge. Press 5 for Nothing prevents"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question8",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question8", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const barriersList = {
        1: "Cost",
        2: "Distance",
        3: "Fear of discrimination",
        4: "Lack of knowledge.",
        2: "Nothing prevents",
    };
  
    userResponses[callSid].barriers = barriersList[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Do you know about contraceptive methods? Press 1 for Yes, all types. Press 2 for Some, but not all. Press 3 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question9",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question9", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes, all types",
        1: "Some, but not all",
        3: "No"
    };
  
    userResponses[callSid].contraceptives = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Have you received any formal education on SRH? Press 1 for Yes, in school. Press 2 for Yes, through a campaign. Press 3 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question10",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question10", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes, in school",
        2: "Yes, through a campaign",
        3: "No",
    };
  
    userResponses[callSid].education = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Do you know the signs and symptoms of STDs? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question11",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question11", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes",
        2: "No"
    };
  
    userResponses[callSid].knowSigns = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Have you ever used contraception? Press 1 for Yes, always. Press 2 for Yes, sometimes. Press 3 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question12",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question12", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes, always",
        2: "Yes, sometimes",
        3: "No"
    };
  
    userResponses[callSid].usedContraception = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Have you been tested for HIV in the last 12 months? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question13",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question13", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes",
        2: "No"
    };
  
    userResponses[callSid].hivTest = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Do you know the risks of teenage pregnancy? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question14",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question14", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes",
        2: "No"
    };
  
    userResponses[callSid].knowPregnancyRisk = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Do you know where to get prenatal care if needed? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question15",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question15", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes",
        2: "No"
    };
  
    userResponses[callSid].knowPrenatalCare = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Have you heard about HIV prevention methods such as PrEP? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question16",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question16", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes",
        2: "No"
    };
  
    userResponses[callSid].heardPrevention = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Do you know where to get tested for HIV? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question17",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question17", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes",
        2: "No"
    };
  
    userResponses[callSid].tested = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Do you know your sexual and reproductive rights? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question18",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/question18", (req, res) => {
    const callSid = req.body.CallSid;
    const digitPressed = req.body.Digits;
  
    const yesOrNo = {
        1: "Yes",
        2: "No"
    };
  
    userResponses[callSid].knowSexRights = yesOrNo[digitPressed] || "Unknown";
  
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      "Have you ever felt unsafe accessing SRH services? Press 1 for Yes. Press 2 for No"
    );
    twiml.gather({
      numDigits: 1,
      action: "/question19",
      method: "POST",
    });
  
    res.type("text/xml");
    res.send(twiml.toString());
  });

app.post("/question19", (req, res) => {
  const callSid = req.body.CallSid;
  const digitPressed = req.body.Digits;

  const yesOrNo = {
    1: "Yes",
    2: "No"
};

  userResponses[callSid].feltUnsafe = yesOrNo[digitPressed] || "Unknown";

  console.log(`Responses for ${callSid}:`, userResponses[callSid]);

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say("Thank you for your participation. Goodbye.");
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

app.post("/call-complete", async (req, res) => {
  console.log(req.body)
  const { CallSid } = req.body;
  if (!CallSid) return res.status(400).send("Error: Missing CallSid");

  const call = await Call.findOne({ callSid: CallSid });
  if (call) {
      call.endTime = new Date();
      call.duration = moment(call.endTime).diff(moment(call.startTime), 'seconds');
      call.answers = userResponses[CallSid]
      await call.save();
  }

  res.send("Call logged.");
});


app.get("/metrics", async (req, res) => {
  const totalCalls = await Call.countDocuments();
  const uniqueCallers = await Call.distinct("phoneNumber").then(data => data.length);
  const repeatCallers = await Call.aggregate([{ $group: { _id: "$phoneNumber", count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }]).then(data => data.length);
  const avgDuration = await Call.aggregate([{ $group: { _id: null, avgDuration: { $avg: "$duration" } } }]).then(data => data[0]?.avgDuration || 0);
  const popularOptions = await Call.aggregate([{ $unwind: "$menuSelections" }, { $group: { _id: "$menuSelections", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

  res.json({
      totalCalls,
      uniqueCallers,
      repeatCallers,
      avgCallDuration: avgDuration,
      popularMenuOptions: popularOptions,
  });
});


app.listen(port, () => console.log(`Server running on port ${port}`));
