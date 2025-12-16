# Community Features Documentation

## Overview
The Community Board is a full-featured social platform where parents can create posts, share experiences, ask for advice, and interact with the community through likes and saves.

## Features

### 1. Create Posts
- **Access**: Tap "Start a new post" button
- **Required Fields**:
  - Title (max 100 characters)
  - Description/Excerpt (max 500 characters)
  - At least one topic tag
- **Topic Tags Available**:
  - Feeding & Nutrition
  - Sleep & Rest
  - Health & Wellness
  - Milestones & Development
  - Parenting Tips
  - Community Support
  - Questions & Advice
  - Success Stories

**Flow**:
1. Modal opens with form fields
2. Enter title and description
3. Select one or more topic tags
4. Character count displays for each field
5. Tap close to cancel or "Publish" to submit
6. Posts are stored in database with author name and timestamp

### 2. View Posts
- **Display**: All community posts show in main feed
- **Post Information**:
  - Title and author
  - Post date (short format: "Dec 15")
  - Full description text
  - Topic tags (light pink background)
  - Like and Save counts with action buttons

### 3. Like Posts
- **Action**: Tap "Like" button on any post
- **Authentication**: Requires login (prompts if not authenticated)
- **Visual Feedback**:
  - Button changes to "Liked" when active
  - Button background highlights in yellow when liked
  - Like count updates immediately
- **Toggle**: Tap again to unlike the post

**API Endpoint**: `POST /api/posts/:id/like`

### 4. Save Posts
- **Action**: Tap "Save" button on any post
- **Authentication**: Requires login (prompts if not authenticated)
- **Visual Feedback**:
  - Button changes to "Saved" when active
  - Button background highlights in yellow when saved
  - Save count updates immediately
- **Toggle**: Tap again to unsave the post

**API Endpoint**: `POST /api/posts/:id/save`

### 5. View Your Activity
- **Liked Posts**: System tracks all posts you've liked
- **Saved Posts**: System tracks all posts you've saved
- **Persistence**: Likes and saves are stored in database, visible across app sessions

## Design

### Colors & Styling
- **Background**: Dark navy (#09282eff)
- **Primary Accent**: Pink (#FED8FE) for titles and headings
- **Secondary Accent**: Yellow (#FDFECC) for active states and secondary text
- **Teal Accent**: #2F9BA8 for borders and tertiary elements
- **Text Colors**: 
  - Light text: #E8FBFF
  - Muted text: #A4CDD3

### UI Components

#### Post Card
- Teal border with semi-transparent teal background
- Title in light text (bold)
- Author and date in muted text
- Excerpt in regular light text
- Tags in small pills with pink text
- Action buttons with toggle states

#### Action Buttons
- Inactive: Teal border, semi-transparent background
- Active: Yellow border, yellow-highlighted background, yellow text
- Show current count in parentheses: "Like (5)"
- Equal width, centered layout
- Disabled during request (loading state)

#### Modal Form
- Full screen overlay
- Header with close button and publish button
- Three form sections (title, description, tags)
- Character counters for text inputs
- Tag selection grid with active/inactive states
- Loading overlay during submission

## Technical Implementation

### Frontend State Management

**Main State Variables**:
```tsx
const [posts, setPosts] = useState<Post[]>([]); // All posts
const [userLikes, setUserLikes] = useState<number[]>([]); // Post IDs user liked
const [userSaves, setUserSaves] = useState<number[]>([]); // Post IDs user saved
const [isModalVisible, setIsModalVisible] = useState(false); // Modal visibility
const [interactionLoading, setInteractionLoading] = useState<number | null>(null); // Loading state for like/save
```

### Data Flow

**On App Load**:
1. Fetch all posts from `/api/posts?limit=50`
2. Fetch user's liked post IDs from `/api/user/likes`
3. Fetch user's saved post IDs from `/api/user/saves`
4. Display posts with user's like/save status reflected

**Create Post**:
1. Validate form inputs
2. Get JWT token from AsyncStorage
3. POST to `/api/posts` with title, excerpt, and tags
4. Add new post to top of feed
5. Clear form and close modal

**Like/Save Post**:
1. Get JWT token from AsyncStorage
2. POST to `/api/posts/:id/like` or `/api/posts/:id/save`
3. Update local userLikes/userSaves array
4. Update post's like/save count
5. Visual feedback with loading state

### Authentication
- Uses JWT tokens stored in AsyncStorage
- All post creation and interaction endpoints require valid token
- Token included in `Authorization: Bearer <token>` header
- Prompts user to login if attempting action without authentication

### Backend Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| POST | /api/posts | ✓ | Create new post |
| GET | /api/posts | ✗ | Fetch all posts |
| GET | /api/posts/:id | ✗ | Get single post |
| POST | /api/posts/:id/like | ✓ | Toggle like |
| POST | /api/posts/:id/save | ✓ | Toggle save |
| GET | /api/user/likes | ✓ | Get user's liked post IDs |
| GET | /api/user/saves | ✓ | Get user's saved posts |
| GET | /api/user/posts | ✓ | Get user's own posts |
| DELETE | /api/posts/:id | ✓ | Delete user's post |

## Error Handling

- **Missing Fields**: Alert dialog with specific missing field message
- **No Tag Selected**: Alert dialog prompting tag selection
- **Not Logged In**: Alert dialog with login prompt
- **Network Error**: Alert dialog with retry option
- **Server Error**: Alert dialog with error details from backend

## Future Enhancements

- Comments/replies on posts
- Trending topics
- User profiles and follow system
- Search and filtering
- Post editing
- Real-time notifications for likes/saves
- Share to social media
- Image/media uploads
- Post reports and moderation
