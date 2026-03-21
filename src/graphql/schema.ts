export const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    role: String!
  }

  type CostPerM2 {
    low: Float!
    typical: Float!
    high: Float!
  }

  type CategoryBreakdown {
    category: String!
    low: Float!
    typical: Float!
    high: Float!
  }

  type EstimateInputData {
    region: String!
    projectType: String!
    propertyType: String!
    totalAreaM2: Float!
    condition: String!
    finishLevel: String!
  }

  type EstimateResultData {
    totalLow: Float!
    totalTypical: Float!
    totalHigh: Float!
    costPerM2: CostPerM2!
    categories: [CategoryBreakdown!]!
  }

  type Estimate {
    id: ID!
    userId: ID!
    name: String!
    input: EstimateInputData!
    result: EstimateResultData!
    purchasePrice: Float
    gdv: Float
    createdAt: String!
    updatedAt: String!
  }

  type Profile {
    id: ID!
    email: String!
    role: String!
    displayName: String
    phone: String
    avatarUrl: String
    businessName: String
    tradeSpecialty: String
    bio: String
    yearsExperience: Int
    locationCity: String
    locationPostcode: String
    websiteUrl: String
    serviceRadiusMiles: Int
    onboardingComplete: Boolean!
    isVerified: Boolean!
    isPublic: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type GalleryItem {
    id: ID!
    userId: ID!
    title: String!
    description: String
    imageUrl: String!
    thumbnailUrl: String
    projectType: String
    beforeImageUrl: String
    locationCity: String
    estimatedCost: Float
    isFeatured: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Notification {
    id: ID!
    userId: ID!
    type: String!
    title: String!
    body: String!
    link: String
    isRead: Boolean!
    createdAt: String!
  }

  input CreateEstimateInput {
    name: String
    region: String!
    propertyType: String!
    totalAreaM2: Float!
    condition: String!
    finishLevel: String!
    purchasePrice: Float
    gdv: Float
  }

  input UpdateProfileInput {
    displayName: String
    phone: String
    avatarUrl: String
    businessName: String
    tradeSpecialty: String
    bio: String
    yearsExperience: Int
    locationCity: String
    locationPostcode: String
    websiteUrl: String
    isPublic: Boolean
  }

  type Query {
    me: User
    estimates(limit: Int = 50): [Estimate!]!
    estimate(id: ID!): Estimate
    gallery(limit: Int = 50): [GalleryItem!]!
    notifications(unreadOnly: Boolean = false, limit: Int = 50): [Notification!]!
  }

  type Mutation {
    createEstimate(input: CreateEstimateInput!): Estimate!
    updateProfile(input: UpdateProfileInput!): Profile!
    markNotificationRead(id: ID!): Boolean!
  }
`;
