const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());
const port = process.env.PORT;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    const employeeCollection = database.collection("employees");

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
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100);

        const search = (req.query.search || "").trim();
        const category = (req.query.category || "").trim();
        const status = (req.query.status || "").trim();
        const sort = req.query.sort || "latest";

        const skip = (page - 1) * limit;

        const query = {};

        // Search
        if (search) {
          query.$or = [
            {
              productName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              productCode: {
                $regex: search,
                $options: "i",
              },
            },
            {
              brand: {
                $regex: search,
                $options: "i",
              },
            },
          ];
        }

        // Category
        if (category) {
          query.category = category;
        }

        // Status
        if (status) {
          query.status = status;
        }

        // Sort
        let sortOption = {
          lastUpdate: -1,
        };

        if (sort === "oldest") {
          sortOption = {
            lastUpdate: 1,
          };
        }

        if (sort === "price-low") {
          sortOption = {
            dpPrice: 1,
          };
        }

        if (sort === "price-high") {
          sortOption = {
            dpPrice: -1,
          };
        }

        const totalProducts = await productsCollection.countDocuments(query);

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

    // ================================
    // UPDATE PRODUCT
    // ================================

    app.patch("/api/products/:id", async (req, res) => {
      try {
        const { id } = req.params;

        console.log("UPDATE PRODUCT ID:", id);

        console.log("UPDATE PRODUCT DATA:", req.body);

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid product ID",
          });
        }

        const productData = {
          ...req.body,

          // Automatically update date
          lastUpdate: new Date(),
        };

        // MongoDB _id update করা যাবে না
        delete productData._id;

        const result = await productsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: productData,
          },
        );

        console.log("UPDATE RESULT:", result);

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Product not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Product updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("UPDATE PRODUCT ERROR:", error);

        res.status(500).send({
          success: false,
          message: error.message || "Failed to update product",
        });
      }
    });

    // ================================
    // DELETE PRODUCT
    // ================================

    app.delete("/api/products/:id", async (req, res) => {
      try {
        const { id } = req.params;

        console.log("DELETE PRODUCT ID:", id);

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid product ID",
          });
        }

        const result = await productsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        console.log("DELETE RESULT:", result);

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Product not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Product deleted successfully",
        });
      } catch (error) {
        console.error("DELETE PRODUCT ERROR:", error);

        res.status(500).send({
          success: false,
          message: error.message || "Failed to delete product",
        });
      }
    });

    // top 6 products

    app.get("/api/products/top-latest", async (req, res) => {
      try {
        const products = await productsCollection
          .find({
            status: "active",
          })
          .sort({
            lastUpdate: -1,
          })
          .limit(6)
          .toArray();

        res.status(200).send({
          success: true,
          products,
        });
      } catch (error) {
        console.error("TOP PRODUCTS ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to get latest products",
        });
      }
    });



    // ================================
    // ADD EMPLOYEE PROFILE
    // ================================

    app.post("/api/admin/employees", async (req, res) => {
      try {
        const employee = req.body;

        if (!employee.userId) {
          return res.status(400).send({
            success: false,
            message: "userId is required",
          });
        }

        if (!employee.name) {
          return res.status(400).send({
            success: false,
            message: "Employee name is required",
          });
        }

        if (!employee.email) {
          return res.status(400).send({
            success: false,
            message: "Employee email is required",
          });
        }

        if (!employee.phone) {
          return res.status(400).send({
            success: false,
            message: "Employee phone is required",
          });
        }

        const existingEmployee = await employeeCollection.findOne({
          userId: employee.userId,
        });

        if (existingEmployee) {
          return res.status(409).send({
            success: false,
            message: "Employee profile already exists",
          });
        }

        const employeeData = {
          ...employee,

          role: "EMPLOYEE",
          status: "active",

          createdAt: new Date(),
          updatedAt: new Date(),
        };

        delete employeeData._id;

        const result = await employeeCollection.insertOne(employeeData);

        res.status(201).send({
          success: true,
          message: "Employee added successfully",
          employeeId: result.insertedId,
        });
      } catch (error) {
        console.error("ADD EMPLOYEE ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to add employee",
        });
      }
    });

    // ================================
    // GET ALL EMPLOYEES
    // SEARCH + STATUS FILTER
    // ================================

    app.get("/api/employees", async (req, res) => {
      try {
        const search = (req.query.search || "").trim();
        const status = (req.query.status || "").trim();

        const query = {};

        // Search
        if (search) {
          query.$or = [
            {
              name: {
                $regex: search,
                $options: "i",
              },
            },
            {
              email: {
                $regex: search,
                $options: "i",
              },
            },
            {
              phone: {
                $regex: search,
                $options: "i",
              },
            },
            {
              designation: {
                $regex: search,
                $options: "i",
              },
            },
            {
              department: {
                $regex: search,
                $options: "i",
              },
            },
          ];
        }

        // Status filter
        if (status) {
          query.status = status;
        }

        const employees = await employeeCollection
          .find(query)
          .sort({
            createdAt: -1,
          })
          .toArray();

        res.status(200).send({
          success: true,
          employees,
        });
      } catch (error) {
        console.error("GET EMPLOYEES ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to get employees",
        });
      }
    });

    // ================================
    // GET SINGLE EMPLOYEE
    // ================================

    app.get("/api/employees/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid employee ID",
          });
        }

        const employee = await employeeCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!employee) {
          return res.status(404).send({
            success: false,
            message: "Employee not found",
          });
        }

        res.status(200).send({
          success: true,
          employee,
        });
      } catch (error) {
        console.error("GET EMPLOYEE ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to get employee",
        });
      }
    });

    // ================================
    // UPDATE EMPLOYEE
    // ================================

    app.patch("/api/employees/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid employee ID",
          });
        }

        const employeeData = {
          ...req.body,
          updatedAt: new Date(),
        };

        // MongoDB _id change করা যাবে না
        delete employeeData._id;

        // Employee role manually change করতে দেব না
        employeeData.role = "EMPLOYEE";

        const result = await employeeCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: employeeData,
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Employee not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Employee updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("UPDATE EMPLOYEE ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to update employee",
        });
      }
    });

    // ================================
    // UPDATE EMPLOYEE STATUS
    // ================================

    app.patch("/api/employees/:id/status", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid employee ID",
          });
        }

        if (!["active", "inactive"].includes(status)) {
          return res.status(400).send({
            success: false,
            message: "Invalid employee status",
          });
        }

        const result = await employeeCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status,
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Employee not found",
          });
        }

        res.status(200).send({
          success: true,
          message: `Employee ${status === "active" ? "activated" : "deactivated"} successfully`,
        });
      } catch (error) {
        console.error("UPDATE EMPLOYEE STATUS ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to update employee status",
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
