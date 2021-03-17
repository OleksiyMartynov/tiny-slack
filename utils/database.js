import mongoose from "mongoose";

export const connect = (databaseUrl) => {
  mongoose.disconnect();
  return mongoose.connect(databaseUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};
export const promisify = (func) => new Promise((resolve, reject) => {
  func.then(
    resolve,
    reject,
  );
})