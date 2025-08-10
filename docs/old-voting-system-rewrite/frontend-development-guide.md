# Frontend Development Guide

## Overview

The MyAEGEE frontend is built with Vue 2 and follows established patterns for API communication, state management, and component architecture. This guide provides comprehensive information for developing new features and maintaining consistency across the application.

## Technology Stack

### Core Technologies

**Framework & Libraries:**

- **Vue 2**: Core framework with Options API
- **Vuex**: Centralized state management
- **Vue Router**: Client-side routing
- **Axios**: HTTP client for API requests
- **Buefy**: Vue.js components based on Bulma CSS framework

**Build & Development Tools:**

- **Vue CLI**: Project scaffolding and build system
- **Babel**: JavaScript transpilation
- **ESLint**: Code linting with Airbnb configuration
- **Webpack**: Module bundling (via Vue CLI)

**UI & Styling:**

- **Bulma CSS**: CSS framework for responsive design
- **Font Awesome**: Icon library
- **Animate.css**: CSS animations

### Project Structure

```
frontend/src/
├── components/          # Reusable Vue components
│   ├── SelectOrCustom.vue
│   ├── PasswordToggle.vue
│   ├── EmptyTableStub.vue
│   └── Tooltip.vue
├── views/              # Page-level components
│   ├── core/           # User management, bodies, etc.
│   ├── events/         # Event management
│   ├── statutory/      # Statutory events
│   └── dashboard/      # Dashboard views
├── router/             # Vue Router configuration
│   └── index.js
├── store/              # Vuex store modules
│   ├── modules/
│   ├── actions.js
│   ├── getters.js
│   └── index.js
├── filters/            # Global Vue filters
├── methods/            # Global Vue methods
├── styles/             # Global CSS/SCSS
├── scripts/            # Utility scripts
├── auth.js             # Authentication plugin
├── app.js              # Vue app configuration
└── main.js             # Application entry point
```

## Application Setup and Configuration

### Main Application Setup

**app.js - Core Configuration:**

```javascript
import Vue from "vue";
import axios from "axios";
import VueAxios from "vue-axios";
import { sync } from "vuex-router-sync";
import Buefy from "buefy";
import flatPickr from "vue-flatpickr-component";
import Multiselect from "vue-multiselect";
import InputTag from "vue-input-tag";
import qs from "qs";
import Vue2TouchEvents from "vue2-touch-events";
import VTooltip from "v-tooltip";

import App from "./App.vue";
import FontAwesomeIcon from "./fontawesome";
import NProgress from "./scripts/vue-nprogress";
import router from "./router";
import store from "./store";
import filters from "./filters";
import Auth from "./auth";

// Configure axios for API requests
axios.defaults.paramsSerializer = (params) =>
  qs.stringify(params, {
    arrayFormat: "brackets",
    encode: false,
    encodeValuesOnly: true,
  });

// Global Vue configuration
Vue.router = router;
Vue.use(VueAxios, axios);
Vue.use(Auth); // Custom authentication plugin
Vue.use(NProgress); // Progress bar for navigation
Vue.use(Buefy, {
  defaultNoticeQueue: false,
  defaultIconPack: "fa",
});
Vue.use(flatPickr); // Date picker
Vue.use(Vue2TouchEvents); // Touch events for mobile
Vue.use(VTooltip); // Tooltip directive

// Register global components
Vue.component("multiselect", Multiselect);
Vue.component("input-tag", InputTag);
Vue.component("select-or-custom", SelectOrCustom);
Vue.component("password-toggle", PasswordToggle);
Vue.component("empty-table-stub", EmptyTableStub);
Vue.component("font-awesome-icon", FontAwesomeIcon);
Vue.component("tooltip", Tooltip);

// Sync router state with store
sync(store, router);

// Create Vue instance
export const app = new Vue({
  router,
  store,
  render: (h) => h(App),
});
```

### Service Configuration

**services.json - API Endpoint Mapping:**

```json
{
  "core": "/api/core",
  "mailer": "/api/mailer",
  "events": "/api/events",
  "summeruniversity": "/api/summeruniversity",
  "statutory": "/api/statutory",
  "discounts": "/api/discounts",
  "network": "/api/network",
  "gsuite-wrapper": "/api/gsuite-wrapper",
  "oms-frontend": "",
  "core-static": "/media/core",
  "events-static": "/media/events",
  "summeruniversity-static": "/media/summeruniversity",
  "statutory-static": "/media/statutory"
}
```

## State Management with Vuex

### Store Structure

**store/index.js - Main Store Configuration:**

```javascript
import Vue from "vue";
import Vuex from "vuex";
import pkg from "package";
import * as actions from "./actions";
import * as getters from "./getters";

import app from "./modules/app";
import menu from "./modules/menu";
import login from "./modules/login";
import services from "./modules/services";

Vue.use(Vuex);

const store = new Vuex.Store({
  strict: process.env.NODE_ENV !== "production",
  actions,
  getters,
  modules: {
    app, // Application state (loading, errors, etc.)
    menu, // Navigation menu state
    login, // Authentication state
    services, // Service endpoint configuration
  },
  state: {
    pkg, // Package.json information
  },
  mutations: {},
});

export default store;
```

### Authentication Module

**store/modules/login.js:**

```javascript
import * as types from "../mutation-types";
import { validate } from "../../validate-user";

const state = {
  isLoggedIn: false,
  user: null,
  isValid: true,
  validationErrors: {},
  permissions: [],
};

const mutations = {
  [types.LOGIN](newState) {
    newState.isLoggedIn = true;
  },

  [types.SET_USER](newState, user) {
    newState.isLoggedIn = true;
    newState.user = user;

    // Validate user data
    newState.validationErrors = validate(user);
    newState.isValid = Object.keys(newState.validationErrors).length === 0;
  },

  [types.SET_PERMISSIONS](newState, permissions) {
    newState.permissions = permissions;
  },

  [types.LOGOUT](newState) {
    newState.isLoggedIn = false;
    newState.user = null;
    newState.permissions = [];
  },
};

const getters = {
  user: (state) => state.user,
  isLoggedIn: (state) => state.isLoggedIn,
  permissions: (state) => state.permissions,
  isValid: (state) => state.isValid,
  validationErrors: (state) => state.validationErrors,
};

const actions = {
  login({ commit }) {
    commit(types.LOGIN);
  },

  setUser({ commit }, user) {
    commit(types.SET_USER, user);
  },

  setPermissions({ commit }, permissions) {
    commit(types.SET_PERMISSIONS, permissions);
  },

  logout({ commit }) {
    commit(types.LOGOUT);
    window.localStorage.removeItem("access-token");
    window.localStorage.removeItem("refresh-token");
  },
};

export default {
  state,
  mutations,
  getters,
  actions,
};
```

### Services Module

**store/modules/services.js:**

```javascript
import servicesJSON from "../../services.json";

const state = {
  services: servicesJSON,
};

const getters = {
  services: (state) => state.services,
};

export default {
  state,
  getters,
};
```

## Authentication Plugin

### Auth Plugin Implementation

**auth.js - Custom Authentication Plugin:**

```javascript
import store from "vuex-store";
import services from "./services.json";

export default {
  install(Vue) {
    const login = async (params) => {
      const res = await Vue.axios.post(services["core"] + "/login", params);
      if (!res.data.success) {
        throw res.data;
      }

      // Store tokens in localStorage
      window.localStorage.setItem("access-token", res.data.access_token);
      window.localStorage.setItem("refresh-token", res.data.refresh_token);

      // Update Vuex store
      store.dispatch("login");

      return res.data;
    };

    const fetchUser = async () => {
      // Prevent request if no tokens available
      if (
        !window.localStorage.getItem("access-token") &&
        !window.localStorage.getItem("refresh-token")
      ) {
        throw new Error("Both access and refresh token are not present.");
      }

      const result = await Vue.axios.get(services["core"] + "/members/me", {
        headers: { "X-For-Auth": "true" },
      });

      if (!result.data.success) {
        throw result.data;
      }

      store.dispatch("setUser", result.data.data);
      return result.data.data;
    };

    const fetchPermissions = async () => {
      const result = await Vue.axios.get(services["core"] + "/my_permissions");

      if (!result.data.success) {
        throw result.data;
      }

      store.dispatch("setPermissions", result.data.data);
      return result.data.data;
    };

    const fetchUserWithExistingData = async () => {
      try {
        await fetchUser(); // Re-fetch user data and renew token if needed
        await fetchPermissions();
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        store.dispatch("logout");
        throw error;
      }
    };

    const logout = () => {
      store.dispatch("logout");
      // Redirect to login page
      Vue.router.push("/login");
    };

    // Attach methods to Vue prototype
    Vue.prototype.$auth = {
      login,
      fetchUser,
      fetchPermissions,
      fetchUserWithExistingData,
      logout,
    };
  },
};
```

### Axios Interceptors

**HTTP Request/Response Interceptors:**

```javascript
// Request interceptor - automatically attach auth token
axios.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("access-token");
  if (token) {
    config.headers["X-Auth-Token"] = token;
  }
  return config;
});

// Response interceptor - handle token refresh and errors
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = window.localStorage.getItem("refresh-token");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const response = await axios.post(services["core"] + "/refresh", {
          refresh_token: refreshToken,
        });

        if (response.data.success) {
          // Update stored token
          window.localStorage.setItem(
            "access-token",
            response.data.access_token
          );

          // Retry original request with new token
          originalRequest.headers["X-Auth-Token"] = response.data.access_token;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        store.dispatch("logout");
        router.push("/login");
      }
    }

    return Promise.reject(error);
  }
);
```

## Component Development Patterns

### Standard Component Structure

**Example List Component:**

```vue
<template>
  <div class="events-list">
    <!-- Header with actions -->
    <div class="level">
      <div class="level-left">
        <div class="level-item">
          <h1 class="title">{{ title }}</h1>
        </div>
      </div>
      <div class="level-right">
        <div class="level-item">
          <router-link
            v-if="canCreate"
            :to="{ name: 'events.create' }"
            class="button is-primary"
          >
            <span class="icon">
              <font-awesome-icon :icon="['fa', 'plus']" />
            </span>
            <span>Create Event</span>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Filters and search -->
    <div class="box" v-if="showFilters">
      <div class="field is-grouped">
        <div class="control is-expanded">
          <input
            v-model="query"
            @input="refetch"
            class="input"
            type="text"
            placeholder="Search events..."
          />
        </div>
        <div class="control">
          <div class="select">
            <select v-model="selectedType" @change="refetch">
              <option value="">All Types</option>
              <option
                v-for="type in eventTypes"
                :key="type.value"
                :value="type.value"
              >
                {{ type.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="has-text-centered">
      <div class="loader is-large"></div>
    </div>

    <!-- Events list -->
    <div v-else-if="events.length" class="events">
      <div v-for="event in events" :key="event.id" class="card event-card">
        <div class="card-content">
          <div class="media">
            <div class="media-left" v-if="event.image">
              <figure class="image is-64x64">
                <img
                  :src="
                    services['events-static'] + '/headimages/' + event.image
                  "
                  :alt="event.name"
                />
              </figure>
            </div>
            <div class="media-content">
              <router-link
                :to="{
                  name: 'events.view',
                  params: { id: event.url || event.id },
                }"
              >
                <p class="title is-4">
                  {{ event.name }}
                  <b-tag v-if="event.method === 'online'" type="is-info">
                    Online
                  </b-tag>
                </p>
              </router-link>
              <p class="subtitle is-6">
                {{ event.starts | date }} - {{ event.ends | date }}
              </p>
            </div>
          </div>

          <div class="content">
            <span v-html="$options.filters.markdown(event.description)" />

            <div class="tags">
              <span class="tag" :class="typeClass(event.type)">
                {{ eventTypesNames[event.type] }}
              </span>
              <span v-if="event.fee" class="tag is-warning">
                €{{ event.fee }}
              </span>
            </div>
          </div>

          <div class="field is-grouped" v-if="showActions">
            <p class="control">
              <router-link
                :to="{
                  name: 'events.view',
                  params: { id: event.url || event.id },
                }"
                class="button"
              >
                View Details
              </router-link>
            </p>
            <p class="control" v-if="canEdit(event)">
              <router-link
                :to="{ name: 'events.edit', params: { id: event.id } }"
                class="button is-warning"
              >
                Edit
              </router-link>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <empty-table-stub
      v-else
      message="No events found"
      :show-create="canCreate"
      create-label="Create First Event"
      @create="$router.push({ name: 'events.create' })"
    />

    <!-- Load more button -->
    <div class="field" v-if="canLoadMore">
      <button
        class="button is-primary is-fullwidth"
        :class="{ 'is-loading': isLoadingMore }"
        :disabled="isLoadingMore"
        @click="loadMore"
      >
        Load More Events
      </button>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import constants from "@/constants";

export default {
  name: "EventsList",
  props: {
    title: {
      type: String,
      default: "Events",
    },
    showFilters: {
      type: Boolean,
      default: true,
    },
    showActions: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      events: [],
      eventTypes: Object.entries(constants.EVENT_TYPES_NAMES).map(
        ([value, name]) => ({
          value,
          name,
        })
      ),
      eventTypesNames: constants.EVENT_TYPES_NAMES,
      isLoading: false,
      isLoadingMore: false,
      query: "",
      selectedType: "",
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null, // For request cancellation
    };
  },
  computed: {
    ...mapGetters(["services", "user", "permissions"]),

    canCreate() {
      return this.permissions.some((p) => p.combined.includes("create:event"));
    },

    queryObject() {
      const params = {
        limit: this.limit,
        offset: this.offset,
      };

      if (this.query) params.search = this.query;
      if (this.selectedType) params.type = this.selectedType;

      return params;
    },
  },
  methods: {
    canEdit(event) {
      return (
        this.permissions.some(
          (p) =>
            p.combined.includes("edit:event") ||
            p.combined.includes("manage:event")
        ) || event.organizer_id === this.user?.id
      );
    },

    typeClass(type) {
      const classes = {
        training: "is-success",
        conference: "is-info",
        nwm: "is-warning",
        cultural: "is-danger",
      };
      return classes[type] || "is-light";
    },

    async fetchData() {
      if (this.source) {
        this.source.cancel("New request initiated");
      }

      this.source = this.axios.CancelToken.source();
      this.isLoading = true;

      try {
        const response = await this.axios.get(
          this.services["events"] + "/events",
          {
            params: this.queryObject,
            cancelToken: this.source.token,
          }
        );

        if (response.data.success) {
          this.events =
            this.offset === 0
              ? response.data.data
              : [...this.events, ...response.data.data];

          this.canLoadMore = response.data.data.length === this.limit;
          this.offset += this.limit;
        } else {
          this.$buefy.toast.open({
            message: response.data.message || "Failed to load events",
            type: "is-danger",
          });
        }
      } catch (error) {
        if (!this.axios.isCancel(error)) {
          this.$buefy.toast.open({
            message: "Failed to load events",
            type: "is-danger",
          });
        }
      } finally {
        this.isLoading = false;
        this.isLoadingMore = false;
      }
    },

    async loadMore() {
      this.isLoadingMore = true;
      await this.fetchData();
    },

    refetch() {
      this.events = [];
      this.offset = 0;
      this.canLoadMore = true;
      this.fetchData();
    },
  },
  watch: {
    // React to route changes
    $route() {
      this.refetch();
    },
  },
  async mounted() {
    await this.fetchData();
  },
  beforeDestroy() {
    // Cancel any pending requests
    if (this.source) {
      this.source.cancel("Component destroyed");
    }
  },
};
</script>

<style scoped>
.event-card {
  margin-bottom: 1rem;
}

.event-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.loader {
  width: 3rem;
  height: 3rem;
  border: 2px solid #dbdbdb;
  border-top-color: #3273dc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
```

### Form Component Pattern

**Standard Form Component:**

```vue
<template>
  <div class="event-form">
    <form @submit.prevent="submit">
      <div class="field">
        <label class="label">Event Name *</label>
        <div class="control">
          <input
            v-model="form.name"
            :class="{ 'is-danger': errors.name }"
            class="input"
            type="text"
            placeholder="Enter event name"
          />
        </div>
        <p v-if="errors.name" class="help is-danger">{{ errors.name }}</p>
      </div>

      <div class="field">
        <label class="label">Description *</label>
        <div class="control">
          <textarea
            v-model="form.description"
            :class="{ 'is-danger': errors.description }"
            class="textarea"
            placeholder="Event description"
            rows="4"
          >
          </textarea>
        </div>
        <p v-if="errors.description" class="help is-danger">
          {{ errors.description }}
        </p>
      </div>

      <div class="columns">
        <div class="column">
          <div class="field">
            <label class="label">Start Date *</label>
            <div class="control">
              <flat-pickr
                v-model="form.starts"
                :config="datePickerConfig"
                :class="{ 'is-danger': errors.starts }"
                class="input"
                placeholder="Select start date"
              >
              </flat-pickr>
            </div>
            <p v-if="errors.starts" class="help is-danger">
              {{ errors.starts }}
            </p>
          </div>
        </div>
        <div class="column">
          <div class="field">
            <label class="label">End Date *</label>
            <div class="control">
              <flat-pickr
                v-model="form.ends"
                :config="datePickerConfig"
                :class="{ 'is-danger': errors.ends }"
                class="input"
                placeholder="Select end date"
              >
              </flat-pickr>
            </div>
            <p v-if="errors.ends" class="help is-danger">{{ errors.ends }}</p>
          </div>
        </div>
      </div>

      <div class="field is-grouped">
        <div class="control">
          <button
            type="submit"
            :class="{ 'is-loading': isSubmitting }"
            :disabled="isSubmitting"
            class="button is-primary"
          >
            {{ submitLabel }}
          </button>
        </div>
        <div class="control">
          <router-link :to="cancelRoute" class="button"> Cancel </router-link>
        </div>
      </div>
    </form>
  </div>
</template>

<script>
import { mapGetters } from "vuex";

export default {
  name: "EventForm",
  props: {
    event: {
      type: Object,
      default: null,
    },
    submitLabel: {
      type: String,
      default: "Save Event",
    },
    cancelRoute: {
      type: Object,
      default: () => ({ name: "events.list" }),
    },
  },
  data() {
    return {
      form: {
        name: "",
        description: "",
        starts: null,
        ends: null,
        type: "training",
        fee: null,
        ...this.event,
      },
      errors: {},
      isSubmitting: false,
      datePickerConfig: {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
      },
    };
  },
  computed: {
    ...mapGetters(["services"]),
  },
  methods: {
    validateForm() {
      this.errors = {};

      if (!this.form.name?.trim()) {
        this.errors.name = "Event name is required";
      }

      if (!this.form.description?.trim()) {
        this.errors.description = "Description is required";
      }

      if (!this.form.starts) {
        this.errors.starts = "Start date is required";
      }

      if (!this.form.ends) {
        this.errors.ends = "End date is required";
      }

      if (
        this.form.starts &&
        this.form.ends &&
        new Date(this.form.starts) >= new Date(this.form.ends)
      ) {
        this.errors.ends = "End date must be after start date";
      }

      return Object.keys(this.errors).length === 0;
    },

    async submit() {
      if (!this.validateForm()) {
        this.$buefy.toast.open({
          message: "Please fix the form errors",
          type: "is-danger",
        });
        return;
      }

      this.isSubmitting = true;

      try {
        const url = this.event
          ? `${this.services["events"]}/events/${this.event.id}`
          : `${this.services["events"]}/events`;

        const method = this.event ? "put" : "post";

        const response = await this.axios[method](url, this.form);

        if (response.data.success) {
          this.$buefy.toast.open({
            message: this.event
              ? "Event updated successfully"
              : "Event created successfully",
            type: "is-success",
          });

          this.$router.push({
            name: "events.view",
            params: { id: response.data.data.id },
          });
        } else {
          throw new Error(response.data.message || "Failed to save event");
        }
      } catch (error) {
        this.$buefy.toast.open({
          message: error.message || "Failed to save event",
          type: "is-danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
  },
  watch: {
    event: {
      handler(newEvent) {
        if (newEvent) {
          this.form = { ...this.form, ...newEvent };
        }
      },
      immediate: true,
      deep: true,
    },
  },
};
</script>
```

## Router Configuration

### Route Structure

**router/index.js - Main Router Configuration:**

```javascript
import Vue from "vue";
import Router from "vue-router";
import store from "@/store";

Vue.use(Router);

const router = new Router({
  mode: "history",
  routes: [
    {
      path: "/",
      name: "dashboard",
      component: () => import("@/views/dashboard/Dashboard.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/auth/Login.vue"),
      meta: { requiresGuest: true },
    },

    // Events routes
    {
      path: "/events",
      name: "events",
      component: () => import("@/views/events/Layout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "events.list",
          component: () => import("@/views/events/List.vue"),
        },
        {
          path: "create",
          name: "events.create",
          component: () => import("@/views/events/Create.vue"),
          meta: { permission: "create:event" },
        },
        {
          path: ":id",
          name: "events.view",
          component: () => import("@/views/events/View.vue"),
          props: true,
        },
        {
          path: ":id/edit",
          name: "events.edit",
          component: () => import("@/views/events/Edit.vue"),
          props: true,
          meta: { permission: "edit:event" },
        },
      ],
    },

    // Statutory routes
    {
      path: "/statutory",
      name: "statutory",
      component: () => import("@/views/statutory/Layout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "statutory.list",
          component: () => import("@/views/statutory/List.vue"),
        },
        {
          path: ":id",
          name: "statutory.view",
          component: () => import("@/views/statutory/View.vue"),
          props: true,
        },
      ],
    },

    // Proposals routes (new)
    {
      path: "/proposals",
      name: "proposals",
      component: () => import("@/views/proposals/Layout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "proposals.list",
          component: () => import("@/views/proposals/List.vue"),
        },
        {
          path: "create",
          name: "proposals.create",
          component: () => import("@/views/proposals/Create.vue"),
          meta: { permission: "create:proposal" },
        },
        {
          path: ":id",
          name: "proposals.view",
          component: () => import("@/views/proposals/View.vue"),
          props: true,
        },
      ],
    },
  ],
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const requiresGuest = to.matched.some((record) => record.meta.requiresGuest);
  const requiredPermission = to.meta.permission;

  const token = window.localStorage.getItem("access-token");
  const isLoggedIn = store.getters.isLoggedIn;

  // Check authentication requirement
  if (requiresAuth && !token) {
    return next("/login");
  }

  if (requiresGuest && token) {
    return next("/");
  }

  // Load user data if logged in but not in store
  if (token && !isLoggedIn) {
    try {
      await store.dispatch("app/loadUserData");
    } catch (error) {
      window.localStorage.removeItem("access-token");
      window.localStorage.removeItem("refresh-token");
      return next("/login");
    }
  }

  // Check permission requirement
  if (requiredPermission && isLoggedIn) {
    const hasPermission = store.getters.permissions.some((p) =>
      p.combined.includes(requiredPermission)
    );

    if (!hasPermission) {
      store.dispatch("app/showError", "Insufficient permissions");
      return next("/");
    }
  }

  next();
});

export default router;
```

## Global Utilities

### Filters

**filters/index.js - Global Vue Filters:**

```javascript
import moment from "moment";
import DOMPurify from "dompurify";
import { marked } from "marked";

// Date formatting
export const date = (value) => {
  if (!value) return "";
  return moment(value).format("DD MMM YYYY");
};

export const datetime = (value) => {
  if (!value) return "";
  return moment(value).format("DD MMM YYYY HH:mm");
};

export const fromNow = (value) => {
  if (!value) return "";
  return moment(value).fromNow();
};

// Text formatting
export const truncate = (text, length = 100) => {
  if (!text) return "";
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
};

export const capitalize = (text) => {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Markdown rendering
export const markdown = (text) => {
  if (!text) return "";
  const html = marked(text);
  return DOMPurify.sanitize(html);
};

// Number formatting
export const currency = (value, currency = "EUR") => {
  if (typeof value !== "number") return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
};

export const number = (value) => {
  if (typeof value !== "number") return value;
  return new Intl.NumberFormat().format(value);
};

// Export all filters
export default {
  date,
  datetime,
  fromNow,
  truncate,
  capitalize,
  markdown,
  currency,
  number,
};
```

### Global Methods

**methods/index.js - Global Vue Methods:**

```javascript
export default {
  // Show success message
  showSuccess(message) {
    this.$buefy.toast.open({
      message,
      type: "is-success",
      duration: 3000,
    });
  },

  // Show error message
  showError(message, error = null) {
    console.error("Error:", error);
    this.$buefy.toast.open({
      message: message || "An error occurred",
      type: "is-danger",
      duration: 5000,
    });
  },

  // Show warning message
  showWarning(message) {
    this.$buefy.toast.open({
      message,
      type: "is-warning",
      duration: 4000,
    });
  },

  // Confirm dialog
  async confirm(message, title = "Confirm Action") {
    return new Promise((resolve) => {
      this.$buefy.dialog.confirm({
        title,
        message,
        confirmText: "Confirm",
        cancelText: "Cancel",
        type: "is-warning",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  },

  // Check permission
  can(permission) {
    return this.permissions.some(
      (p) =>
        p.combined.includes(permission) ||
        p.combined.includes(`global:${permission}`) ||
        p.combined.includes(`local:${permission}`)
    );
  },
};
```

## Adding New Features

### Creating New Service Pages

When adding pages for the new Proposals or Votings microservices:

1. **Create service-specific directories:**

   ```
   src/views/proposals/
   ├── Layout.vue          # Layout wrapper
   ├── List.vue           # Proposals list
   ├── Create.vue         # Create proposal form
   ├── Edit.vue           # Edit proposal form
   ├── View.vue           # View proposal details
   └── components/        # Proposal-specific components
   ```

2. **Add routes to router configuration**
3. **Update services configuration**
4. **Follow established component patterns**

### Consistent Error Handling

**Global Error Handler:**

```javascript
// In main app configuration
Vue.config.errorHandler = (err, vm, info) => {
  console.error("Global error:", err, info);

  // Send to error tracking service
  if (window.Bugsnag) {
    window.Bugsnag.notify(err, {
      context: info,
      user: vm.$store.getters.user,
    });
  }

  // Show user-friendly message
  if (vm.$buefy) {
    vm.$buefy.toast.open({
      message: "An unexpected error occurred",
      type: "is-danger",
    });
  }
};
```

This frontend development guide provides the foundation for building consistent, maintainable Vue.js applications within the MyAEGEE ecosystem while following established patterns and best practices.
