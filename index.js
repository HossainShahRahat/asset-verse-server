const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.swu9d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("assetVerse");
    const users = db.collection("users");
    const assets = db.collection("assets");
    const requests = db.collection("requests");
    const team = db.collection("employeeAffiliations");

    // --- Auth ---
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // --- Users ---
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isExist = await users.findOne(query);
      if (isExist) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await users.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });

    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await users.findOne({ email });
      res.send(result);
    });

    app.patch("/users/upgrade", verifyToken, async (req, res) => {
      const { email, limit, type } = req.body;
      const query = { email: email };
      const doc = { $set: { packageLimit: limit, subscription: type } };
      const result = await users.updateOne(query, doc);
      res.send(result);
    });

    // --- Assets ---
    app.post("/assets", verifyToken, async (req, res) => {
      const info = req.body;
      const result = await assets.insertOne(info);
      res.send(result);
    });

    app.get("/assets", verifyToken, async (req, res) => {
      const email = req.query.email;
      const search = req.query.search;
      const sort = req.query.sort;
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;

      let query = {};
      if (email) query.hrEmail = email;
      if (search) query.productName = { $regex: search, $options: "i" };

      let options = {};
      if (sort === "asc") options = { productQuantity: 1 };
      if (sort === "desc") options = { productQuantity: -1 };

      const result = await assets
        .find(query)
        .sort(options)
        .skip(page * limit)
        .limit(limit)
        .toArray();

      res.send(result);
    });

    // --- Requests ---
    app.post("/requests", verifyToken, async (req, res) => {
      const info = req.body;
      const result = await requests.insertOne(info);
      res.send(result);
    });

    app.get("/requests", verifyToken, async (req, res) => {
      const email = req.query.email;
      const search = req.query.search;
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;

      let query = {};
      if (email) query.hrEmail = email;
      if (search) {
        query.$or = [
          { requesterName: { $regex: search, $options: "i" } },
          { requesterEmail: { $regex: search, $options: "i" } },
        ];
      }

      const result = await requests
        .find(query)
        .skip(page * limit)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    // --- CRITICAL UPDATE: Approval Logic with Limit Check ---
    app.patch("/requests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const {
        status,
        assetId,
        requesterEmail,
        requesterName,
        hrEmail,
        companyName,
        companyLogo,
      } = req.body;

      // 1. If Approving, CHECK LIMIT first
      if (status === "approved") {
        const hrUser = await users.findOne({ email: hrEmail });
        const currentTeamSize = await team.countDocuments({ hrEmail: hrEmail });

        // Check if this employee is ALREADY in the team
        const existingMember = await team.findOne({
          employeeEmail: requesterEmail,
          hrEmail: hrEmail,
        });

        // If not in team AND limit reached, BLOCK IT
        if (!existingMember && currentTeamSize >= hrUser.packageLimit) {
          return res.send({
            message: "limit reached",
            insertedId: null,
            modifiedCount: 0,
          });
        }
      }

      // 2. Proceed with Update
      const filter = { _id: new ObjectId(id) };
      const doc = { $set: { status: status, actionDate: new Date() } };
      const result = await requests.updateOne(filter, doc);

      // 3. Post-Update Actions
      if (status === "approved") {
        await assets.updateOne(
          { _id: new ObjectId(assetId) },
          { $inc: { availableQuantity: -1 } }
        );

        const existingMember = await team.findOne({
          employeeEmail: requesterEmail,
          hrEmail: hrEmail,
        });

        if (!existingMember) {
          await team.insertOne({
            employeeEmail: requesterEmail,
            employeeName: requesterName,
            hrEmail: hrEmail,
            companyName: companyName,
            companyLogo: companyLogo,
            role: "employee",
          });

          await users.updateOne(
            { email: requesterEmail },
            { $set: { companyName: companyName, companyLogo: companyLogo } }
          );
        }
      }

      if (status === "returned") {
        await assets.updateOne(
          { _id: new ObjectId(assetId) },
          { $inc: { availableQuantity: 1 } }
        );
      }

      res.send(result);
    });

    // --- Team & Stats ---
    app.get("/my-team/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await team.find({ hrEmail: email }).toArray();
      res.send(result);
    });

    app.delete("/my-team/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await team.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get("/hr-stats/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const returnable = await assets.countDocuments({
        hrEmail: email,
        productType: "Returnable",
      });
      const nonReturnable = await assets.countDocuments({
        hrEmail: email,
        productType: "Non-returnable",
      });
      const pending = await requests.countDocuments({
        hrEmail: email,
        status: "pending",
      });
      const approved = await requests.countDocuments({
        hrEmail: email,
        status: "approved",
      });
      res.send({ returnable, nonReturnable, pending, approved });
    });

    // --- Public & Payment ---
    app.get("/packages", async (req, res) => {
      const packages = [
        {
          name: "Basic",
          price: 5,
          employeeLimit: 5,
          features: ["Asset Tracking", "Employee Management", "Basic Support"],
        },
        {
          name: "Standard",
          price: 8,
          employeeLimit: 10,
          features: [
            "All Basic features",
            "Advanced Analytics",
            "Priority Support",
          ],
        },
        {
          name: "Premium",
          price: 15,
          employeeLimit: 20,
          features: [
            "All Standard features",
            "Custom Branding",
            "24/7 Support",
          ],
        },
      ];
      res.send(packages);
    });

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    //
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("AssetVerse is sitting");
});

app.listen(port, () => {
  console.log(`AssetVerse is sitting on port ${port}`);
});
