import { gqlRequest } from './graphql.client.js';

const GET_PROJECTS = `
  query GetProjects($limit: Int, $offset: Int) {
    projects(limit: $limit, offset: $offset) {
      id
      projectId
      title
      type
      readOnly
      public
      createdAt
      updatedAt
      lineCount
      syncedLineCount
      upload {
        id
        fileName
        title
        source
        duration
        cloudinaryUrl
        youtubeUrl
        spotifyTrackId
        artist
      }
    }
  }
`;

const GET_PROJECT = `
  query GetProject($id: ID!) {
    project(id: $id) {
      id
      projectId
      title
      type
      readOnly
      public
      createdAt
      updatedAt
      state {
        syncMode
        activeLineIndex
        playbackPosition
        playbackSpeed
        saveTime
        timezone
        utcOffset
      }
      metadata {
        description
        tags
      }
      upload {
        id
        fileName
        title
        source
        duration
        cloudinaryUrl
        youtubeUrl
        spotifyTrackId
        artist
      }
      lyrics {
        id
        projectId
        editorMode
        language
        version
        lines {
          text
          timestamp
          endTime
          secondary
          translation
          words { word time reading }
          secondaryWords { word time }
        }
      }
      user {
        id
        username
        avatarUrl
      }
    }
  }
`;

const CREATE_PROJECT = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      projectId
      title
    }
  }
`;

const UPDATE_PROJECT = `
  mutation UpdateProject($id: ID!, $input: UpdateProjectInput!) {
    updateProject(id: $id, input: $input) {
      id
      projectId
      title
      public
      readOnly
    }
  }
`;

const DELETE_PROJECT = `
  mutation DeleteProject($id: ID!) {
    deleteProject(id: $id)
  }
`;

export const projectsService = {
  async create(input) {
    const data = await gqlRequest(CREATE_PROJECT, { input });
    return data.createProject;
  },

  async list(limit = 20, offset = 0) {
    const data = await gqlRequest(GET_PROJECTS, { limit, offset });
    return data.projects;
  },

  async get(id) {
    const data = await gqlRequest(GET_PROJECT, { id });
    return data.project;
  },

  async update(id, input) {
    const data = await gqlRequest(UPDATE_PROJECT, { id, input });
    return data.updateProject;
  },

  // patch maps to update for GQL
  async patch(id, input) {
    return this.update(id, input);
  },

  async remove(id) {
    const data = await gqlRequest(DELETE_PROJECT, { id });
    return data.deleteProject;
  },
};
