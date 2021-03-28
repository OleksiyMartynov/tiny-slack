import { composeMongoose } from "graphql-compose-mongoose";
import { SchemaComposer } from "graphql-compose";

let schema;

function adminAccess(resolvers) {
  Object.keys(resolvers).forEach((k) => {
    resolvers[k] = resolvers[k].wrapResolve((next) => async (rp) => {
      // extend resolve params with hook
      rp.beforeRecordMutate = async function (doc, rp) {
        console.log(rp);
        return doc;
      };

      return next(rp);
    });
  });
  return resolvers;
}

const getSchema = async () => {
  //make sure mongo connection is initialized before using the models
  const Workspace = require("./Workspace").default;
  const User = require("./User").default;
  const Channel = require("./Channel").default;
  const Message = require("./Message").default;
  if (!schema) {
    const schemaComposer = new SchemaComposer(); //todo: debug, potential memory leak accross lambda rebuilds
    const customizationOptions = {
      schemaComposer,
    };
    //Declare the type composers from mongo schemas
    const WorkspaceTC = composeMongoose(Workspace, customizationOptions);
    const UserTC = composeMongoose(User, customizationOptions);
    const ChannelTC = composeMongoose(Channel, customizationOptions);
    const MessageTC = composeMongoose(Message, customizationOptions);

    //Fill in relationships, aka inflate object references
    WorkspaceTC.addRelation("users", {
      resolver: () => UserTC.mongooseResolvers.findMany(),
      prepareArgs: { filter: (source) => ({ _id: { $in: source.users } }) },
      projection: { users: 1 },
    });

    MessageTC.addRelation("user", {
      resolver: () => UserTC.mongooseResolvers.findOne(),
      prepareArgs: { filter: (source) => ({ _id: source.user }) },
      projection: { user: 1 },
    });

    //Add virtual functions
    WorkspaceTC.addFields({userCount:"Int"})

    //Set GraphQL Queries from mongoose
    schemaComposer.Query.addFields({
      workspaceOne: WorkspaceTC.mongooseResolvers.findOne(),
      workspaceMany: WorkspaceTC.mongooseResolvers.findMany(),
      userOne: UserTC.mongooseResolvers.findOne(),
      userMany: UserTC.mongooseResolvers.findMany(),
      channelMany: ChannelTC.mongooseResolvers.findMany(),
      messageMany: MessageTC.mongooseResolvers.findMany(),
    });

    //GraphQL Custom Mutations
    const createUserInNotExistAndPushToWorkspace = {
      type: WorkspaceTC,
      args: {
        workspaceId: "MongoID!",
        name: "String",
        email: "String!",
        avatar_url: "String",
      },
      resolve: async (source, args, context, info) => {
        console.log(args);
        return User.createIfNeededAndAddToWorkspace(
          args.name,
          args.email,
          args.avatar_url,
          args.workspaceId
        );
      },
    };

    //Set GraphQL Mutations from mongoose
    schemaComposer.Mutation.addFields({
      workspaceCreateOne: WorkspaceTC.mongooseResolvers.createOne(),
      userCreateOne: createUserInNotExistAndPushToWorkspace,
      channelCreateOne: ChannelTC.mongooseResolvers.createOne(),
      ...adminAccess({
        messageCreateOne: MessageTC.mongooseResolvers.createOne(),
      }),
    });
    schema = schemaComposer.buildSchema();
  }
  return schema;
};

export default getSchema;
