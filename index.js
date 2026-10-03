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
    const usersCollection = database.collection("user");
    const activitiesCollection = database.collection("activities");

    const createActivity = async ({
      type,
      title,
      description,
      userId = null,
    }) => {
      try {
        await activitiesCollection.insertOne({
          type,
          title,
          description,
          userId,
          createdAt: new Date(),
        });
      } catch (error) {
        console.error("CREATE ACTIVITY ERROR:", error);
      }
    };

    // post product
    app.post("/api/add-product", async (req, res) => {
      try {
        const product = req.body;

        const productWithUpdate = {
          ...product,
          lastUpdate: new Date(),
        };

        const result = await productsCollection.insertOne(productWithUpdate);
        await createActivity({
          type: "product",
          title: "New product added",
          description: `${product.productName || "A product"} was added`,
        });
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
        await createActivity({
          type: "product Update",
          title: "A product update",
          description: `${ "A product"} was update`,
        });
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
        await createActivity({
          type: "employee",
          title: "New employee added",
          description: `${employee.name} was added as an employee`,
          userId: employee.userId || null,
        });
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

    // ========================================
    // UPDATE EMPLOYEE
    // ========================================

    app.patch("/api/employees/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid employee ID",
          });
        }

        const {
          name,
          email,
          profilePhoto,
          designation,
          role,
          department,
          phone,
          alternatePhone,
          address,
          joiningDate,
          status,
        } = req.body;

        const updateData = {
          name,
          email,
          profilePhoto,
          designation,
          role,
          department,
          phone,
          alternatePhone,
          address,
          joiningDate,
          status,
          updatedAt: new Date(),
        };

        delete updateData._id;
        delete updateData.userId;

        const result = await employeeCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: updateData,
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Employee not found",
          });
        }
        await createActivity({
          type: "Employee Update",
          title: "A employee update",
          description: `${name || "A Employee"} was update`,
        });
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

    // ========================================
    // UPDATE EMPLOYEE STATUS
    // ========================================

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
            message: "Invalid status",
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
        await createActivity({
          type: "Employee Status Update",
          title: "A employee status update",
          description: `${"A employee status"} was update`,
        });
        res.status(200).send({
          success: true,
          message: "Employee status updated successfully",
        });
      } catch (error) {
        console.error("EMPLOYEE STATUS ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to update employee status",
        });
      }
    });

    // ================================
    // PUBLIC EMPLOYEES
    // SEARCH + STATUS + PAGINATION
    // ================================

    app.get("/api/public/employees", async (req, res) => {
      try {
        const search = String(req.query.search || "").trim();

        const status = String(req.query.status || "active")
          .trim()
          .toLowerCase();

        const page = Math.max(Number(req.query.page) || 1, 1);

        const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);

        const skip = (page - 1) * limit;

        // =====================================
        // BASE QUERY
        // =====================================

        const query = {
          role: "EMPLOYEE",
        };

        // =====================================
        // STATUS FILTER
        // =====================================

        if (status !== "all") {
          query.status = status;
        }

        // =====================================
        // SEARCH
        // Name / Email / Phone
        // =====================================

        if (search) {
          const searchRegex = new RegExp(
            search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i",
          );

          query.$or = [
            {
              name: searchRegex,
            },
            {
              email: searchRegex,
            },
            {
              phone: searchRegex,
            },
            {
              alternatePhone: searchRegex,
            },
          ];
        }

        // =====================================
        // COUNT
        // =====================================

        const totalEmployees = await employeeCollection.countDocuments(query);

        // =====================================
        // GET DATA
        // =====================================

        const employees = await employeeCollection
          .find(query, {
            projection: {
              password: 0,
            },
          })
          .sort({
            name: 1,
          })
          .skip(skip)
          .limit(limit)
          .toArray();

        // =====================================
        // PAGINATION
        // =====================================

        const totalPages = Math.ceil(totalEmployees / limit);

        // =====================================
        // RESPONSE
        // =====================================

        res.status(200).json({
          success: true,

          employees,

          pagination: {
            currentPage: page,
            totalPages,
            totalEmployees,
            limit,

            hasNextPage: page < totalPages,

            hasPreviousPage: page > 1,
          },
        });
      } catch (error) {
        console.error("GET PUBLIC EMPLOYEES ERROR:", error);

        res.status(500).json({
          success: false,
          message: "Failed to load employees",
          error: error.message,
        });
      }
    });

    // ============================================
    // ADMIN - GET ALL USERS
    // SEARCH + STATUS + PAGINATION
    // 20 USERS PER PAGE
    // ============================================

    app.get("/api/admin/users", async (req, res) => {
      try {
        const search = String(req.query.search || "").trim();

        const status = String(req.query.status || "all")
          .trim()
          .toLowerCase();

        const page = Math.max(Number(req.query.page) || 1, 1);

        // Always maximum 20
        const limit = 20;

        const skip = (page - 1) * limit;

        // ========================================
        // QUERY
        // ========================================

        const query = {};

        // ========================================
        // SEARCH
        // name / email
        // ========================================

        if (search) {
          const searchRegex = new RegExp(
            search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i",
          );

          query.$or = [
            {
              name: searchRegex,
            },
            {
              email: searchRegex,
            },
          ];
        }

        // ========================================
        // STATUS FILTER
        // ========================================

        if (status !== "all") {
          query.status = status;
        }

        // ========================================
        // TOTAL USERS
        // ========================================

        const totalUsers = await usersCollection.countDocuments(query);

        // ========================================
        // USERS
        // IMPORTANT:
        // password / sensitive auth fields
        // will NOT be returned
        // ========================================

        const users = await usersCollection
          .find(query, {
            projection: {
              password: 0,
            },
          })
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .toArray();

        // ========================================
        // PAGINATION
        // ========================================

        const totalPages = Math.ceil(totalUsers / limit);

        res.status(200).json({
          success: true,

          users,

          pagination: {
            currentPage: page,
            limit,
            totalUsers,
            totalPages,

            hasNextPage: page < totalPages,

            hasPreviousPage: page > 1,
          },
        });
      } catch (error) {
        console.error("GET ADMIN USERS ERROR:", error);

        res.status(500).json({
          success: false,
          message: "Failed to get users",
          error: error.message,
        });
      }
    });

    // ============================================
    // ADMIN - BLOCK / UNBLOCK USER
    // ============================================

    app.patch("/api/admin/users/:id/status", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid user ID",
          });
        }

        if (!["active", "blocked"].includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Invalid user status",
          });
        }

        // ======================================
        // FIND USER
        // ======================================

        const user = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        // ======================================
        // DON'T BLOCK ADMIN
        // ======================================

        if (user.role === "ADMIN") {
          return res.status(403).json({
            success: false,
            message: "Admin account cannot be blocked",
          });
        }

        // ======================================
        // UPDATE
        // ======================================

        const result = await usersCollection.updateOne(
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

        res.status(200).json({
          success: true,
          message:
            status === "blocked"
              ? "User blocked successfully"
              : "User unblocked successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("BLOCK USER ERROR:", error);

        res.status(500).json({
          success: false,
          message: "Failed to update user status",
        });
      }
    });

    // ============================================
    // ADMIN - DELETE USER
    // ============================================

    app.delete("/api/admin/users/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid user ID",
          });
        }

        // ======================================
        // FIND USER
        // ======================================

        const user = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        // ======================================
        // DON'T DELETE ADMIN
        // ======================================

        if (user.role === "ADMIN") {
          return res.status(403).json({
            success: false,
            message: "Admin account cannot be deleted",
          });
        }

        // ======================================
        // DELETE
        // ======================================

        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "User deleted successfully",
        });
      } catch (error) {
        console.error("DELETE USER ERROR:", error);

        res.status(500).json({
          success: false,
          message: "Failed to delete user",
        });
      }
    });

    // ========================================
    // ADMIN DASHBOARD OVERVIEW
    // ========================================

    app.get("/api/admin/dashboard/overview", async (req, res) => {
      try {
        const [
          totalProducts,
          activeProducts,
          inactiveProducts,
          totalEmployees,
          activeEmployees,
          inactiveEmployees,
        ] = await Promise.all([
          productsCollection.countDocuments({}),

          productsCollection.countDocuments({
            status: "active",
          }),

          productsCollection.countDocuments({
            status: "inactive",
          }),

          employeeCollection.countDocuments({}),

          employeeCollection.countDocuments({
            status: "active",
          }),

          employeeCollection.countDocuments({
            status: "inactive",
          }),
        ]);

        res.status(200).send({
          success: true,

          overview: {
            products: {
              total: totalProducts,
              active: activeProducts,
              inactive: inactiveProducts,
            },

            employees: {
              total: totalEmployees,
              active: activeEmployees,
              inactive: inactiveEmployees,
            },
          },
        });
      } catch (error) {
        console.error("ADMIN DASHBOARD OVERVIEW ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to load dashboard overview",
        });
      }
    });

    // ========================================
    // ADMIN DASHBOARD - RECENT PRODUCTS
    // ========================================

    app.get("/api/admin/dashboard/recent-products", async (req, res) => {
      try {
        const products = await productsCollection
          .find({})
          .sort({
            lastUpdate: -1,
          })
          .limit(5)
          .toArray();

        res.status(200).send({
          success: true,
          products,
        });
      } catch (error) {
        console.error("ADMIN RECENT PRODUCTS ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to load recent products",
        });
      }
    });

    // ========================================
    // ADMIN DASHBOARD - RECENT EMPLOYEES
    // ========================================

    app.get("/api/admin/dashboard/recent-employees", async (req, res) => {
      try {
        const employees = await employeeCollection
          .find({})
          .sort({
            createdAt: -1,
          })
          .limit(5)
          .toArray();

        res.status(200).send({
          success: true,
          employees,
        });
      } catch (error) {
        console.error("ADMIN RECENT EMPLOYEES ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to load recent employees",
        });
      }
    });

    // ========================================
    // ADMIN DASHBOARD - RECENT ACTIVITIES
    // ========================================

    app.get("/api/admin/dashboard/recent-activities", async (req, res) => {
      try {
        const activities = await activitiesCollection
          .find({})
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .toArray();

        res.status(200).send({
          success: true,
          activities,
        });
      } catch (error) {
        console.error("ADMIN RECENT ACTIVITIES ERROR:", error);

        res.status(500).send({
          success: false,
          message: "Failed to load recent activities",
        });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run()
  .then(() => {
    console.log(
      "MongoDB connection initialized successfully"
    );
  })
  .catch((error) => {
    console.error(
      "MongoDB initialization error:",
      error
    );
  });

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(
      `Local server listening on port ${port}`
    );
  });
}

module.exports = app;
