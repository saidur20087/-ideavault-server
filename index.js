const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://ideavault-client-olive.vercel.app"], credentials: true
}));
app.use(express.json());

// Mongo URI
const uri = process.env.MONGODB_URI;

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
});

async function run() {
  try {
    const db = client.db("ideaVaultDB");
    const ideaCollection = db.collection("ideas");

    // =========================
    // CREATE IDEA
    // =========================
    app.post("/api/ideas", async (req, res) => {
      try {
        const newIdea = req.body;

        if (!newIdea.title || !newIdea.description) {
          return res.status(400).send({
            success: false,
            message: "Title and Description are required",
          });
        }

        const ideaWithMeta = {
          ...newIdea,
          createdAt: new Date(),
          interactions: 0,
          comments: [],
        };

        const result = await ideaCollection.insertOne(ideaWithMeta);

        res.status(201).send({
          success: true,
          message: "Idea created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // =========================
    // GET ALL IDEAS
    // =========================
    app.get("/api/ideas", async (req, res) => {
      try {
        const ideas = await ideaCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          success: true,
          ideas,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // =========================
    // DELETE IDEA
    // =========================
    app.delete("/api/ideas/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await ideaCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Idea not found",
          });
        }

        res.send({
          success: true,
          message: "Idea deleted successfully",
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Delete failed",
        });
      }
    });


    app.delete("/api/interactions/delete", async (req, res) => {
      try {
        const { index } = req.body;

        const ideas = await ideaCollection.find().toArray();

        let all = [];

        ideas.forEach((idea) => {
          idea.comments?.forEach((c) => {
            all.push({
              ideaId: idea._id,
              ideaTitle: idea.title,
              comment: c.text,
              date: c.date,
            });
          });
        });

        // delete by index (SAFE)
        all.splice(index, 1);

        // rebuild ideas comments
        await ideaCollection.updateMany({}, { $set: { comments: [] } });

        for (const item of all) {
          await ideaCollection.updateOne(
            { _id: new ObjectId(item.ideaId) },
            {
              $push: {
                comments: {
                  text: item.comment,
                  date: item.date,
                },
              },
            }
          );
        }

        res.send({
          success: true,
          updatedInteractions: all,
        });
      } catch (err) {
        res.status(500).send({ message: "Delete failed" });
      }
    });

    // =========================
    // GET ALL INTERACTIONS (COMMENTS)
    // =========================
    app.get("/api/interactions", async (req, res) => {
      try {
        const ideas = await ideaCollection.find().toArray();

        let allComments = [];

        ideas.forEach((idea) => {
          if (idea.comments && idea.comments.length > 0) {
            idea.comments.forEach((c) => {
              allComments.push({
                ideaTitle: idea.title,
                comment: c.text,
                date: c.date,
              });
            });
          }
        });

        res.send(allComments);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // =========================
    // GET SINGLE IDEA
    // =========================
    app.get("/api/ideas/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const idea = await ideaCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!idea) {
          return res.status(404).send({
            success: false,
            message: "Idea not found",
          });
        }

        res.send({
          success: true,
          idea,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Invalid ID format",
        });
      }
    });

    // =========================
    // UPDATE IDEA (EDIT)
    // =========================
    app.put("/api/ideas/:id/comment/edit", async (req, res) => {
      const { index, text } = req.body;
      const id = req.params.id;

      const idea = await ideaCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!idea) {
        return res.status(404).send({ message: "Idea not found" });
      }

      idea.comments[index].text = text;

      await ideaCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { comments: idea.comments } }
      );

      res.send({ comments: idea.comments });
    });

    // =========================
    // DELETE IDEA
    // =========================
    app.delete("/api/ideas/:id/comment/:index", async (req, res) => {
      const id = req.params.id;
      const index = parseInt(req.params.index);

      const idea = await ideaCollection.findOne({ _id: new ObjectId(id) });

      idea.comments.splice(index, 1);

      await ideaCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { comments: idea.comments } }
      );

      res.send({ comments: idea.comments });
    });


    // =========================
    // UPDATE IDEA
    // =========================

    app.put("/api/user/update", async (req, res) => {
      try {
        const { email, name, image } = req.body;

        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Email required",
          });
        }

        const result = await userCollection.updateOne(
          { email },
          {
            $set: {
              name,
              image,
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        const updatedUser = await userCollection.findOne({ email });

        return res.status(200).send({
          success: true,
          message: "User updated successfully",
          user: updatedUser,
        });

      } catch (err) {
        console.error("Update error:", err);

        return res.status(500).send({
          success: false,
          message: "Update failed",
        });
      }
    });

    // =========================
    // ADD COMMENT
    // =========================
    app.post("/api/ideas/:id/comment", async (req, res) => {
      try {
        const id = req.params.id;
        const { text } = req.body;

        if (!text) {
          return res.status(400).send({
            success: false,
            message: "Comment text is required",
          });
        }

        const comment = {
          text,
          date: new Date(),
        };

        const result = await ideaCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $push: { comments: comment },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Idea not found",
          });
        }

        const updatedIdea = await ideaCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          comments: updatedIdea.comments || [],
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Something went wrong",
        });
      }
    });

    // =========================
    // DB CONNECT
    // =========================
    // await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected Successfully ");
  } catch (error) {
    console.error("DB Connection Error:", error);
  }
}

run().catch(console.dir);

// Home route
app.get("/", (req, res) => {
  res.send("IdeaVault API Running...");
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

