import Head from "next/head";
import { useRouter } from "next/router";
import { Chat } from "../../components/Chat";
import useNetlifyIdentity from "../../utils/useNetlifyIdentity";
import { useEffect } from "react";
import { executeQuery } from "../../utils/graphqlHelper";
import { useManualQuery } from 'graphql-hooks';

const WORKSPACE_QUERY = `query FindWorkspace($id: MongoID!) {
  workspaceOne(filter: { _id: $id }) {
    _id
    name
    users {name email}
  }
  channelMany(filter: { workspace: $id }) {
    _id
    name
  }
}`;

const WORKSPACE_JOIN_MUTATION = `mutation JoinWorkspace($name: String!, $email: String!, $avatar_url:String!, $workspaceId: MongoID!) {
  userCreateOne(workspaceId:$workspaceId, name:$name, email:$email, avatar_url:$avatar_url){
    name
    users {name email _id}
  }
}`;

const Workspace = ({ workspace }) => {
  const router = useRouter();
  const { id } = router.query;
  const identity = useNetlifyIdentity();
  const [register, { loading, error, data: updatedWorkspace }] = useManualQuery(
    WORKSPACE_JOIN_MUTATION,
    {
      variables: {
        avatar_url:identity?.user?.user_metadata?.avatar_url,
        name:identity?.user?.user_metadata?.full_name,
        email:identity?.user?.email,
        workspaceId:id,
      },
    }
  );
  useEffect(() => {
    if (!identity.user) {
      router.push("/");
    }else{
      console.log(workspace.data.workspaceOne)
      if(workspace.data.workspaceOne.users.filter(u => u.email ===identity.user.email).length===0){
        register();
      }
    }
  }, []);

  if (!id) {
    return <div>No id specified...</div>;
  }
  return (
    <div>
      <Head>
        <title>Tiny-Slack | Workspace</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      Workspace id: {id}
      {loading&& <div>Registering new user...</div>}
      {(error||updatedWorkspace?.errors)&&<div>Failed registration...</div>}
      {updatedWorkspace&&<div>Registered!!!</div>}
      {id && <Chat id={id} user={identity.user} initialWorkspace={workspace} />}
    </div>
  );
};

export default Workspace;

// this function is called serverside, and client side gets the `workspaces` prop
export async function getServerSideProps({ params }) {
  const { data } = await executeQuery(WORKSPACE_QUERY, { id: params.id });
  console.log(data);
  return { props: { workspace: data } };
}
