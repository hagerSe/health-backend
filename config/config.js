import dotenv from "dotenv";

dotenv.config();

export default {
  //   the codeing is t
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: 5432,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      // ssl: {
      // ssl: {
      //   require:true,
      //   rejectUnauthorized:false,
      // }
      //   require: true,
      //   rejectUnauthorized: false, // required for Render Postgres
      // },
    },
  },
  //   for automatted testings . unit tests....
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSARD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: 5432,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      // ssl: {
      //   require: true,
      //   rejectUnauthorized: false, // required for Render Postgres
      // },
    },
  },
  //    live  in  the  enviroments , database : the reals db., usally. cloiud-hosted
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: 5432,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      // ssl: {
      //   require: true,
      //   rejectUnauthorized: false, // required for Render Postgres
      // },
    },
  },
};