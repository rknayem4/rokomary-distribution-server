const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());
const port = process.env.PORT;

const { MongoClient, ServerApiVersion } = require("mongodb");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("rokomary-distribution");
    const productsCollection = database.collection("products");

    // post product
    app.post("/api/add-product", async (req, res) => {
      try {
        const product = req.body;

        const productWithUpdate = {
          ...product,
          lastUpdate: new Date(),
        };

        const result = await productsCollection.insertOne(productWithUpdate);

        res.status(201).send({
          success: true,
          message: "Product added successfully",
          result,
        });
      } catch (error) {
        console.error("Add product error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to add product",
        });
      }
    });

    // get all product
    app.get("/api/products", async (req, res) => {
      try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 12;

        const search = req.query.search || "";
        const category = req.query.category || "";
        const sort = req.query.sort || "latest";

        const skip = (page - 1) * limit;

        // Search
        const query = {};

        if (search.trim()) {
          query.$or = [
            {
              productName: {
                $regex: search.trim(),
                $options: "i",
              },
            },
            {
              productCode: {
                $regex: search.trim(),
                $options: "i",
              },
            },
            {
              brand: {
                $regex: search.trim(),
                $options: "i",
              },
            },
          ];
        }

        // Category filter
        if (category && category !== "All") {
          query.category = category;
        }

        // Sort
        let sortOption = { lastUpdate: -1 };

        if (sort === "oldest") {
          sortOption = { lastUpdate: 1 };
        }

        if (sort === "price-low") {
          sortOption = { dpPrice: 1 };
        }

        if (sort === "price-high") {
          sortOption = { dpPrice: -1 };
        }

        // Total products
        const totalProducts = await productsCollection.countDocuments(query);

        // Products
        const products = await productsCollection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).send({
          success: true,
          products,
          pagination: {
            currentPage: page,
            limit,
            totalProducts,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        });
      } catch (error) {
        console.error("Get products error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to get products",
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
