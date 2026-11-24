<template>
  <div class="tile is-ancestor">
    <div class="tile is-child">
      <form @submit.prevent="saveEvent()">
        <div class="notification is-info" v-if="!$route.params.id">
          <div class="content">
            <p>If you want to upload an image, please do it from the event page after creating the event.</p>
            <p>If you have any questions, please refer to the <a href="https://drive.google.com/drive/folders/1D2OB5gGmyAScf-ITFK1URJ8ZuIZlWCbX" target="_blank" rel="noopener noreferrer">booklets</a> first.</p>
            <p><i>You need a AEGEE Google Workspace account to be able to see the booklets. In case you don't have one,
              <a href="https://oms-project.atlassian.net/wiki/spaces/HEL/pages/248348673/Requesting+a+Gsuite+account+for+yourself" target="blank">
                here's how to request it
              </a>.</i></p>
            <p><strong>Once the event is saved, you are only able to edit some information.</strong> So please check everything twice.</p>
            <p>If you will need the event info to be changed after saving, please contact <a href="mailto:suct@aegee.eu">SUCT</a>.</p>
          </div>
        </div>
        <div class="notification is-info" v-else>
          <div class="content">
            <p>If you want to upload an image, please do it from the event page.</p>
          </div>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Event details</h2>
        <hr />

        <div class="field">
          <label class="label" for="su-name">Title <span class="has-text-danger">*</span></label>
          <div class="control">
            <input id="su-name" class="input" type="text" v-model="event.name" required />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-description">Description <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea id="su-description" class="textarea" placeholder="1-2 sentence long catchy description to be shown on the website before the second submission has been accepted" required v-model="event.description" />
          </div>
          <label class="label">Preview <MarkdownTooltip /></label>
          <div class="content">
            <span v-html="$options.filters.markdown(event.description)" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ') }}</p>
        </div>

        <div class="notification is-info" v-if="!$route.params.id">
          <div class="content">
            <p>
              Event URL is the "short name of the event" and is the part of the address this event would be accessible at.
              That can be handy for the generation of nice events URLs.
            </p>
            <p>For example, when set as <i>my-awesome-event</i>, the event would be accessible at <i>https://my.aegee.eu/summeruniversity/my-awesome-event</i>.</p>
            <p>It can contain only English letters, numbers and hypens and cannot have numbers only.</p>
            <p><strong>Please don't put Facebook event link here, this is meant for another purpose described above</strong>.</p>
          </div>
        </div>

        <div class="field">
          <label class="label" for="su-url">Event URL <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">/summeruniversity/</a>
              </div>
              <div class="control">
                <input id="su-url" class="input" type="text" v-model="event.url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.url">{{ errors.url.join(', ') }}</p>
        </div>

        <div class="field" v-if="can.editEventType">
          <label class="label" for="su-type">Event type <span class="has-text-danger">*</span></label>
          <div class="select">
            <select id="su-type" v-model="event.type">
              <option v-for="(name, type) in eventTypes" v-bind:key="type" v-bind:value="type">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.type">{{ errors.type.join(', ') }}</p>
        </div>

        <div class="field" v-if="managedTypes.includes(event.type || 'regular')">
          <label class="label" for="su-season">Season <span class="has-text-danger">*</span></label>
          <div class="select">
            <select id="su-season" v-model="event.season">
              <option v-for="season in seasons" :key="season.year" :value="season.year">{{ season.name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.season">{{ errors.season.join(', ') }}</p>
        </div>

        <timezone-notification />

        <!-- TODO: start with datePicker on first possible SU start date set by CIA/SUCT -->
        <div class="field">
          <label class="label" for="su-starts">Event start date <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="su-starts"
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.starts" />
          </div>
          <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
          <!-- The application period is set elsewhere; its end has to be before the start. -->
          <p class="help is-danger" v-if="errors.application_ends">{{ errors.application_ends.join(', ') }}</p>
        </div>

        <!-- TODO: start with datePicker on 6 days after first possible SU start date (or set start date) set by CIA/SUCT -->
        <div class="field">
          <label class="label" for="su-ends">Event end date <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="su-ends"
              placeholder="Select date"
              class="input"
              :config="dateConfig"
              v-model="dates.ends" />
          </div>
          <p class="help is-danger" v-if="errors.ends">{{ errors.ends.join(', ') }}</p>
        </div>

        <!-- TODO: If larger than max, show warning that higher fee can only be set by SUCT -->
        <!-- TODO: Have two inputs, one without a maximum for people with the proper permission and one with the maximum based on duration (max 20 euros per night) -->
        <div class="field" v-if="!event.status || event.status === 'first draft' || can.editFee">
          <label class="label" for="su-fee">Fee <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">€</a>
              </div>
              <div class="control">
                <input id="su-fee" class="input" type="number" v-model="event.fee" min="0" required />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.fee">{{ errors.fee.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-max-participants">Max. participants <span class="has-text-danger">*</span></label>
          <div class="control">
            <input id="su-max-participants" class="input" type="number" v-model="event.max_participants" min="0" @input="$root.nullifyIfEmpty(event, 'max_participants')" />
          </div>
          <p class="help is-danger" v-if="errors.max_participants">{{ errors.max_participants.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-accommodation-type">Accommodation type <span class="has-text-danger">*</span></label>
          <div class="notification is-info">
            <p>Accommodation can be for instance camping, hostel, hosting by the members of the local, or in a gym.</p>
          </div>
          <div class="control">
            <input id="su-accommodation-type" class="input" v-model="event.accommodation_type" required />
          </div>
          <p class="help is-danger" v-if="errors.accommodation_type">{{ errors.accommodation_type.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="checkbox">
            <strong>Our SU has university support </strong>
            <input type="checkbox" v-model="event.university_support" />
          </label>
          <p class="help is-danger" v-if="errors.university_support">{{ errors.university_support.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-theme-category">Theme category <span class="has-text-danger">*</span></label>
          <div class="select">
            <select id="su-theme-category" v-model="event.theme_category">
              <option v-for="(name, theme_category) in themeCategories" v-bind:key="theme_category" v-bind:value="theme_category">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.theme_category">{{ errors.theme_category.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-theme">Theme (including explanation) <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea id="su-theme" class="textarea" placeholder="Explain the theme here." required v-model="event.theme" />
          </div>
          <p class="help is-danger" v-if="errors.theme">{{ errors.theme.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-theme-implementation">Theme implementation (only visible for SUCT) <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea id="su-theme-implementation" class="textarea" placeholder="Explain how you are going to implement the theme here." required v-model="event.theme_implementation" />
          </div>
          <p class="help is-danger" v-if="errors.theme_implementation">{{ errors.theme_implementation.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Learning objectives <span class="has-text-danger">*</span></label>
          <table class="table is-narrowed">
            <tbody>
              <tr v-for="(learning_objective, index) in event.learning_objectives" v-bind:key="index">
                <td>
                  <input class="input" type="text" required v-model="learning_objective.description" :aria-label="'Learning objective ' + (index + 1)" />
                </td>
                <td>
                  <button type="button" class="button is-danger" :aria-label="'Delete learning objective ' + (index + 1)" @click="deleteLearningObjective(index)">Delete</button>
                </td>
                <td v-if="event.learning_objectives.length < 5">
                  <button type="button" class="button is-primary" aria-label="Add learning objective" @click="addLearningObjective()">+</button>
                </td>
              </tr>
              <tr v-if="event.learning_objectives.length === 0">
                <td colspan="3">No learning objectives are set.</td>
              </tr>
              <tr v-if="event.learning_objectives.length === 1">
                <td colspan="3"><strong>At least 2 learning objectives have to be set.</strong></td>
              </tr>
              <tr v-if="event.learning_objectives.length >= 5">
                <td colspan="3"><strong>At most 5 learning objectives can be set.</strong></td>
              </tr>
              <tr v-if="event.learning_objectives.length === 0">
                <td colspan="3">
                  <button type="button" class="button is-primary" @click="addLearningObjective()">Add learning objective</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="help is-danger" v-if="errors.learning_objectives">{{ errors.learning_objectives.join(', ') }}</p>

        <div class="field">
          <label class="label" for="su-activities-list">List of activities <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea id="su-activities-list" class="textarea" placeholder="List the main activities here so potential participants know what they can expect from your SU." required v-model="event.activities_list" />
          </div>
          <p class="help is-danger" v-if="errors.activities_list">{{ errors.activities_list.join(', ') }}</p>
        </div>

        <!-- Not used in 2022
        <div class="field">
          <label class="label">Course level</label>
          <div class="select">
            <select v-model="event.course_level">
              <option v-for="(name, course_level) in courseLevels" v-bind:key="course_level" v-bind:value="course_level">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.course_level">{{ errors.course_level.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Courses</label>
          <div class="control">
            <textarea class="textarea" placeholder="List your courses here." v-model="event.courses"></textarea>
          </div>
          <p class="help is-danger" v-if="errors.courses">{{ errors.courses.join(', ') }}</p>
        </div> -->

        <div class="field">
          <label class="label" for="su-trainers">Trainers</label>
          <div class="control">
            <textarea id="su-trainers" class="textarea" placeholder="Do not provide names, just explain if they are from a body, experienced members of your local, etc." v-model="event.trainers" />
          </div>
          <p class="help is-danger" v-if="errors.trainers">{{ errors.trainers.join(', ') }}</p>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Optional Programme</h2>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>You may offer an optional programme to your event. If so, please specify the optional activities and its cost (maximum of 50 euros). Leave the fields empty if there is no extra fee charged. Be concise in the description: "trip to city X", "ice-skating", "extra museum".</p>
          </div>
        </div>
        <div class="field">
          <label class="label" for="su-optional-fee">Optional Fee</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">€</a>
              </div>
              <div class="control">
                <input id="su-optional-fee" class="input" type="number" v-model="event.optional_fee" min="0" max="50" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.optional_fee">{{ errors.optional_fee.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-optional-programme">Optional Programme</label>
          <div class="control">
            <textarea id="su-optional-programme" class="textarea" placeholder="List your optional programme here." v-model="event.optional_programme" />
          </div>
          <p class="help is-danger" v-if="errors.optional_programme">{{ errors.optional_programme.join(', ') }}</p>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Contact information & promotion</h2>
        <hr />

        <div class="field">
          <label class="label" for="su-email">Email <span class="has-text-danger">*</span></label>
          <div class="control">
            <input id="su-email" class="input" type="email" v-model="event.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-website">Website <URLTooltip /></label>
          <div class="control">
            <input id="su-website" class="input" type="url" v-model="event.website" />
          </div>
          <p class="help is-danger" v-if="errors.website">{{ errors.website.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Social media <URLTooltip /></label>
          <table class="table is-narrowed">
            <tbody>
              <tr v-for="(social_medium, index) in event.social_media" v-bind:key="index">
                <td>
                  <input class="input" type="url" required v-model="social_medium.description" :aria-label="'Social media link ' + (index + 1)" />
                </td>
                <td>
                  <button type="button" class="button is-danger" :aria-label="'Delete social media link ' + (index + 1)" @click="deleteSocialMedia(index)">Delete</button>
                </td>
                <td v-if="event.social_media.length < 3">
                  <button type="button" class="button is-primary" aria-label="Add social media link" @click="addSocialMedia()">+</button>
                </td>
              </tr>
              <tr v-if="event.social_media.length === 0">
                <td colspan="3">No social media links are set.</td>
              </tr>
              <tr v-if="event.social_media.length >= 3">
                <td colspan="3"><strong>At most 3 social media links can be set.</strong></td>
              </tr>
              <tr v-if="event.social_media.length === 0">
                <td colspan="3">
                  <button type="button" class="button is-primary" @click="addSocialMedia()">Add social media link</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="help is-danger" v-if="errors.social_media">{{ errors.social_media.join(', ') }}</p>

        <!-- TODO: add ability to upload up to 6 photos (upload after saving) -->
        <div class="field">
          <div class="notification is-warning">
            <div class="content">
              <p><strong>COPYRIGHT:</strong> Make sure you own the rights to the photos. Use photos of previous events made by your own local.
                Or use photos from <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer">pixabay.com</a> or <a href="https://pexels.com" target="_blank" rel="noopener noreferrer">pexels.com</a> for example (free to use photos).</p>
            </div>
          </div>
          <label class="label">Photos <URLTooltip /></label>
          <table class="table is-narrowed">
            <tbody>
              <tr v-for="(photo, index) in event.photos" v-bind:key="index">
                <td>
                  <input class="input" type="url" required v-model="photo.description" :aria-label="'Photo link ' + (index + 1)" />
                </td>
                <td>
                  <button type="button" class="button is-danger" :aria-label="'Delete photo link ' + (index + 1)" @click="deletePhotos(index)">Delete</button>
                </td>
                <td v-if="event.photos.length < 6">
                  <button type="button" class="button is-primary" aria-label="Add link to photo" @click="addPhotos()">+</button>
                </td>
              </tr>
              <tr v-if="event.photos.length === 0">
                <td colspan="3">No links to photos are set.</td>
              </tr>
              <tr v-if="event.photos.length >= 6">
                <td colspan="3"><strong>At most 6 links to photos can be set.</strong></td>
              </tr>
              <tr v-if="event.photos.length === 0">
                <td colspan="3">
                  <button type="button" class="button is-primary" @click="addPhotos()">Add link to photo</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="help is-danger" v-if="errors.photos">{{ errors.photos.join(', ') }}</p>

        <div class="field">
          <label class="label" for="su-video">Video <URLTooltip /></label>
          <div class="control">
            <input id="su-video" class="input" type="url" v-model="event.video" />
          </div>
          <p class="help is-danger" v-if="errors.video">{{ errors.video.join(', ') }}</p>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Organising bodies <span class="has-text-danger">*</span></h2>
        <hr />

        <div class="tags">
          <span
            class="tag is-primary is-medium"
            v-for="(body, index) in event.organizing_bodies"
            v-bind:key="body.body_id">
            {{ bodyName(body) }}
            <button type="button" class="delete is-small" :aria-label="'Remove ' + bodyName(body)" @click.prevent="body => event.organizing_bodies.splice(index, 1)" />
          </span>
          <span class="tag is-danger is-medium" v-if="event.organizing_bodies.length === 0">No organizing bodies.</span>
        </div>
        <p class="help is-danger" v-if="errors.organizing_bodies">{{ errors.organizing_bodies.join(', ') }}</p>

        <div class="field">
          <label class="label" for="su-add-organizing-body">Add organising body</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <div class="select">
                  <select id="su-add-organizing-body" v-model="selectedBody">
                    <option :value="null">--</option>
                    <option v-for="body in bodies" v-bind:key="body.id" v-bind:value="body">{{ body.name }}</option>
                  </select>
                </div>
              </div>
              <div class="control">
                <button type="button" class="button is-primary" aria-label="Add organising body" @click="addOrganizingBody()">Add</button>
              </div>
            </div>
          </div>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Cooperation with a body</h2>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>In order to fulfil the requirements for cooperation with a body, the trainers from the body have to provide <strong>at least half of the minimum tuition hours</strong>
              (e.g. if you organise a Summer University for 14 nights, your minimum number of tuition hours are 28, so the trainers have to provide at least 14<br />
              Attention: compulsory sessions and the AEGEE introduction session are not counted as part of the tuition hours)</p>
          </div>
        </div>
        <div class="tags">
          <span
            class="tag is-primary is-medium"
            v-for="(body, index) in event.cooperation"
            v-bind:key="body.body_id">
            {{ bodyName(body) }}
            <button type="button" class="delete is-small" :aria-label="'Remove ' + bodyName(body)" @click.prevent="body => event.cooperation.splice(index, 1)" />
          </span>
          <span class="tag is-danger is-medium" v-if="event.cooperation.length === 0">No cooperation with bodies.</span>
        </div>
        <p class="help is-danger" v-if="errors.cooperation">{{ errors.cooperation.join(', ') }}</p>

        <div class="field">
          <label class="label" for="su-add-cooperation">Add cooperation</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <div class="select">
                  <select id="su-add-cooperation" v-model="selectedCooperation">
                    <option :value="null">--</option>
                    <option v-for="body in bodies" v-bind:key="body.id" v-bind:value="body">{{ body.name }}</option>
                  </select>
                </div>
              </div>
              <div class="control">
                <button type="button" class="button is-primary" aria-label="Add cooperation body" @click="addCooperation()">Add</button>
              </div>
            </div>
          </div>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Organisers <span class="has-text-danger">*</span></h2>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>The user creating the event automatically becomes an organiser.</p>
            <p>People who are not listed as organisers won't be able to see and manage event applications, even if they are the board members.</p>
            <p><strong>You can only add people from the organising and cooperation bodies.</strong></p>
            <p>Please add at least:<br />
              - 1 main coordinator per organising body<br />
              - 1 content manager<br />
              - 1 treasurer<br />
              - 1 incoming responsible</p>
          </div>
        </div>

        <div>
          <b-table
            :data="event.organizers"
            :loading="isLoading">
            <b-table-column field="first_name" label="First and last name" sortable v-slot="props">
              <router-link target="_blank" rel="noopener noreferrer" :to="{ name: 'oms.members.view', params: { id: props.row.user_id } }">
                {{ organizerName(props.row) }}
              </router-link>
            </b-table-column>

            <b-table-column field="role" label="Role" v-slot="props">
              <div class="select">
                <select v-model="props.row.role" :aria-label="'Role of ' + organizerName(props.row)">
                  <option v-for="(name, role) in roles" v-bind:key="role" v-bind:value="role">{{ name }}</option>
                </select>
              </div>
            </b-table-column>

            <b-table-column label="Delete" v-slot="props">
              <button type="button" class="button is-small is-danger" v-if="!props.row.disableEdit" :aria-label="'Delete ' + organizerName(props.row)" @click="deleteOrganizer(props.index)">
                Delete
              </button>
            </b-table-column>

            <template slot="empty">
              <empty-table-stub />
            </template>
          </b-table>
          <p class="help is-danger" v-if="errors.organizers">{{ errors.organizers.join(', ') }}</p>

          <div class="field">
            <label class="label" for="su-add-organizer">Add organiser</label>
            <div class="control">
              <div class="field has-addons">
                <b-autocomplete
                  id="su-add-organizer"
                  v-model="autoComplete.members.name"
                  :data="autoComplete.members.values"
                  open-on-focus="true"
                  :loading="autoComplete.members.loading"
                  @input="query => fetchMembers(query)"
                  @select="organizer => addOrganizer(organizer)">
                  <template slot-scope="props">
                    <div class="media">
                      <div class="media-content">
                        {{ props.option.first_name }}
                        <br>
                        <small> {{ props.option.last_name }} </small>
                      </div>
                    </div>
                  </template>
                </b-autocomplete>
              </div>
            </div>
          </div>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Locations <span class="has-text-danger">*</span></h2>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>You can add a location and drag it on the map to the desired point.</p>
            <p>The location name would be displayed as a map marker popup.</p>
            <p>Please mention the name of the city in the 'Name' field, and mention the city the SU starts in and the city the SU ends in.</p>
          </div>
        </div>

        <div class="tile" role="region" aria-label="Map" style="position: relative; height: 400px">
          <MglMap
            :accessToken="accessToken"
            :mapStyle="map.style"
            :zoom="map.zoom"
            :scrollZoom="false"
            @load="onMapLoaded"
            :center="map.center">
            <MglNavigationControl position="top-right" />
            <MglMarker
              v-for="(location, index) in event.locations"
              v-bind:key="index"
              :coordinates="location.position"
              color="red"
              :draggable="true"
              @dragend="setMarkerPosition($event, index)" />
          </MglMap>
        </div>

        <table class="table is-narrowed is-stripped is-fullwidth">
          <thead>
            <tr>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Name <span class="has-text-danger">*</span></th>
              <th>Description</th>
              <th>Starting city</th>
              <th>Ending city</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(marker, index) in event.locations" v-bind:key="index">
              <td>{{ marker.position.lat }}</td>
              <td>{{ marker.position.lng }}</td>
              <td>
                <input type="text" class="input" required v-model="marker.name" :aria-label="'Location ' + (index + 1) + ' name'" />
              </td>
              <td>
                <textarea class="textarea" v-model="marker.description" :aria-label="'Location ' + (index + 1) + ' description'" />
              </td>
              <td>
                <input type="radio" name="start_loc" v-model="marker.start" :value="true" @change="chooseCity(index, 'start')" :aria-label="'Location ' + (index + 1) + ' is the starting city'" />
              </td>
              <td>
                <input type="radio" name="end_loc" v-model="marker.end" :value="true" @change="chooseCity(index, 'end')" :aria-label="'Location ' + (index + 1) + ' is the ending city'" />
              </td>
              <td>
                <button type="button" class="button is-danger" :aria-label="'Delete location ' + (index + 1)" @click="deleteLocation(index)">Delete location</button>
              </td>
            </tr>
            <tr v-if="event.locations.length === 0">
              <td colspan="5">No locations added.</td>
            </tr>
          </tbody>
        </table>

        <div class="field">
          <div class="control">
            <button type="button" class="button is-primary" @click="addLocation()">Add new location</button>
          </div>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Participant info</h2>
        <hr />

        <div class="field">
          <label class="label" for="su-pax-confirmation">Confirmation needed</label>
          <div class="select">
            <select id="su-pax-confirmation" v-model="event.pax_confirmation">
              <option v-for="(name, pax_confirmation) in paxConfirmations" v-bind:key="pax_confirmation" v-bind:value="pax_confirmation">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.pax_confirmation">{{ errors.pax_confirmation.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-pax-description">Ideal participant</label>
          <div class="control">
            <textarea id="su-pax-description" class="textarea" placeholder="Explain what should participants of your SU look like." v-model="event.pax_description" />
          </div>
          <p class="help is-danger" v-if="errors.pax_description">{{ errors.pax_description.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-special-equipment">Special equipment needed</label>
          <div class="control">
            <textarea id="su-special-equipment" class="textarea" placeholder="Explain if participants need special equipment for your SU." v-model="event.special_equipment" />
          </div>
          <p class="help is-danger" v-if="errors.special_equipment">{{ errors.special_equipment.join(', ') }}</p>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Questions</h2>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>If you have any specific questions relevant for the applicants for your SU, you can add them here.</p>
          </div>
        </div>
        <div class="field">
          <table class="table is-narrowed">
            <tbody>
              <tr v-for="(question, index) in event.questions" v-bind:key="index">
                <td>
                  <input class="input" type="text" required v-model="question.description" :aria-label="'Question ' + (index + 1)" />
                </td>
                <td>
                  <button type="button" class="button is-danger" :aria-label="'Delete question ' + (index + 1)" @click="deleteQuestion(index)">Delete</button>
                </td>
                <td v-if="event.questions.length < 3">
                  <button type="button" class="button is-primary" aria-label="Add question" @click="addQuestion()">+</button>
                </td>
              </tr>
              <tr v-if="event.questions.length === 0">
                <td colspan="3">No questions are set.</td>
              </tr>
              <tr v-if="event.questions.length >= 3">
                <td colspan="3"><strong>At most 3 questions can be set.</strong></td>
              </tr>
              <tr v-if="event.questions.length === 0">
                <td colspan="3">
                  <button type="button" class="button is-primary" @click="addQuestion()">Add question</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="help is-danger" v-if="errors.questions">{{ errors.questions.join(', ') }}</p>

        <h2 class="subtitle is-fullwidth has-text-centered">Regulations</h2>
        <hr />

        <div class="field">
          <label class="label" for="su-cancellation-rules">Payment and cancellation rules <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea id="su-cancellation-rules" class="textarea" placeholder="Payment and cancellation rules set by your SU." required v-model="event.cancellation_rules" />
          </div>
          <p class="help is-danger" v-if="errors.cancellation_rules">{{ errors.cancellation_rules.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-additional-regulation">SU specific regulations <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea id="su-additional-regulation" class="textarea" placeholder="Additional regulations set by your SU." required v-model="event.additional_regulation" />
          </div>
          <p class="help is-danger" v-if="errors.additional_regulation">{{ errors.additional_regulation.join(', ') }}</p>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">SUCT approval fields</h2>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>These fields are visible to SUCT only.</p>
            <p>The preliminary budget is optional for the first submission, unless you are planning to request an exception to the maximal fee.</p>
            <p>Please provide the link to Google spreadsheets for the event programme and budget. Be sure that SUCT can open it.</p>
            <p><a href="https://docs.google.com/spreadsheets/u/1/?ftv=1&tgif=d" target="_blank" rel="noopener noreferrer">
              You can take the templates for the budget and programme here.
            </a></p>
            <p><i>
              Note: in case you cannot see AEGEE templates at the link above, try switching to AEGEE Google Workspace account.
              In case you don't have one,
              <a href="https://oms-project.atlassian.net/wiki/spaces/HEL/pages/248348673/Requesting+a+Gsuite+account+for+yourself" target="blank">
                here's how to request it
              </a>.
            </i></p>
          </div>
        </div>

        <div class="field">
          <label class="label" for="su-budget">Link to preliminary budget <URLTooltip /></label>
          <div class="control">
            <input id="su-budget" class="input" type="url" v-model="event.budget" />
          </div>
          <p class="help is-danger" v-if="errors.is_budget_set">{{ errors.is_budget_set.join(', ') }}</p>
          <p class="help is-danger" v-if="errors.budget">{{ errors.budget.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="su-programme-suct">Link to preliminary programme <span class="has-text-danger">*</span> <URLTooltip /></label>
          <div class="control">
            <input id="su-programme-suct" class="input" type="url" v-model="event.programme_suct" required />
          </div>
          <p class="help is-danger" v-if="errors.is_programme_set">{{ errors.is_programme_set.join(', ') }}</p>
          <p class="help is-danger" v-if="errors.programme_suct">{{ errors.programme_suct.join(', ') }}</p>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">SU terms</h2>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p><strong>The general SU terms are the following:</strong><br />
              - We are able to provide meals 2x per day, also to people with specific dietary needs.<br />
              - We are able to provide accommodation for all the nights of the event for every participant.<br />
              - We are able to provide 2 hours of tuition per night on average.<br />
              - We are able to provide all the activities with the participation fee of 20 EUR per night (excluding the optional fee and its activities).</p>
          </div>
        </div>

        <div class="field">
          <label class="checkbox">
            I agree with the general SU terms.<span class="has-text-danger">* </span>
            <input type="checkbox" required v-model="event.agreed_to_su_terms" />
          </label>
          <p class="help is-danger" v-if="errors.agreed_to_su_terms">{{ errors.agreed_to_su_terms.join(', ') }}</p>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save event" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import 'mapbox-gl/dist/mapbox-gl.css'
import 'flatpickr/dist/flatpickr.css'
import flatPickr from 'vue-flatpickr-component'
import { MglMap, MglMarker, MglNavigationControl } from 'vue-mapbox'
import constants from '../../constants'
import credentials from '../../credentials'
import TimezoneNotification from '../../components/notifications/TimezoneNotification'
import MarkdownTooltip from '../../components/tooltips/MarkdownTooltip'
import URLTooltip from '../../components/tooltips/URLTooltip'

// TODO: check that all unused code is removed
export default {
  components: {
    flatPickr,
    MglMap,
    MglMarker,
    MglNavigationControl,
    TimezoneNotification,
    MarkdownTooltip,
    URLTooltip
  },
  name: 'EditEvent',
  data () {
    return {
      event: {
        id: null,
        name: null,
        url: null,
        image: null,
        photos: [],
        video: null,
        description: '', // so it won't be null and marked() would not error
        email: null,
        website: null,
        social_media: [],
        starts: null,
        ends: null,
        fee: null,
        optional_fee: null,
        organizing_bodies: [],
        cooperation: [],
        locations: [],
        theme_category: null,
        theme: null,
        theme_implementation: null,
        learning_objectives: [],
        questions: [],
        organizers: [],
        max_participants: null,
        budget: null,
        programme_suct: null,
        activities_list: null,
        optional_programme: null,
        accommodation_type: null,
        university_support: false,
        course_level: null,
        courses: null,
        trainers: null,
        pax_confirmation: null,
        pax_description: null,
        special_equipment: null,
        cancellation_rules: null,
        additional_regulation: null,
        agreed_to_su_terms: false
      },
      autoComplete: {
        members: { name: '', values: [], loading: false }
      },
      dates: {
        starts: null,
        ends: null
      },
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 3
      },
      eventTypes: constants.SUMMERUNIVERSITY_TYPES_NAMES,
      paxConfirmations: constants.SUMMERUNIVERSITY_PAX_CONFIRMATIONS,
      themeCategories: constants.SUMMERUNIVERSITY_THEMES_NAMES,
      roles: constants.SUMMERUNIVERSITY_ROLES,
      courseLevels: constants.SUMMERUNIVERSITY_COURSE_LEVELS,
      file: null,
      bodies: [],
      selectedBody: null,
      selectedCooperation: null,
      dateConfig: {
        enableTime: true,
        time_24hr: true,
        // Typing a date works, also with a keyboard only, and phones get the same picker
        // instead of their own date input.
        allowInput: true,
        disableMobile: true
      },
      seasons: [],
      // The event types the user can manage. Only managers of the event's type can choose its season.
      managedTypes: [],
      can: {
        editEventType: false,
        editFee: false
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    fetchMembers (query) {
      if (!query) return

      this.autoComplete.members.values = []
      this.autoComplete.members.loading = true

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      // Organisers have to be members of an organising or cooperation body, so only those are searched.
      const bodyIds = [...this.event.organizing_bodies, ...(this.event.cooperation || [])].map(body => body.body_id).join(',')
      if (!bodyIds) {
        this.autoComplete.members.loading = false
        return this.$root.showWarning('Please add an organising body first.')
      }

      this.axios.get(this.services['core'] + '/members_search', {
        cancelToken: this.token.token,
        params: { query, body_id: bodyIds }
      }).then((res) => {
        this.autoComplete.members.values = res.data.data
        this.autoComplete.members.loading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.autoComplete.members.loading = false
        this.$root.showError('Could not fetch members', err)
      })
    },
    addOrganizer (organizer) {
      if (this.event.organizers.some(org => org.user_id === organizer.id)) {
        return this.$root.showWarning('This user is already an organiser.')
      }

      this.event.organizers.push({
        user_id: organizer.id,
        first_name: organizer.first_name,
        last_name: organizer.last_name
      })
    },
    // The name of an organiser, once core has given it, and otherwise their user id.
    organizerName (organizer) {
      return [organizer.first_name, organizer.last_name].filter(Boolean).join(' ') || 'Member ' + organizer.user_id
    },
    deleteOrganizer (index) {
      this.event.organizers.splice(index, 1)
    },
    addQuestion () {
      this.event.questions.push({
        name: '',
        description: '',
        required: false
      })
    },
    deleteQuestion (index) {
      this.event.questions.splice(index, 1)
    },
    addLearningObjective () {
      this.event.learning_objectives.push({
        name: '',
        description: ''
      })
    },
    deleteLearningObjective (index) {
      this.event.learning_objectives.splice(index, 1)
    },
    addSocialMedia () {
      this.event.social_media.push({
        name: '',
        description: ''
      })
    },
    deleteSocialMedia (index) {
      this.event.social_media.splice(index, 1)
    },
    addPhotos () {
      this.event.photos.push({
        name: '',
        description: ''
      })
    },
    deletePhotos (index) {
      this.event.photos.splice(index, 1)
    },
    addLocation () {
      this.event.locations.push({
        name: '',
        description: '',
        position: {
          lat: this.map.center.lat,
          lng: this.map.center.lng
        }
      })
    },
    deleteLocation (index) {
      this.event.locations.splice(index, 1)
    },
    // An SU starts in one location and ends in one: choosing another one unsets the one
    // chosen before. Each row has its own value, so the radios alone would keep both.
    chooseCity (index, key) {
      this.event.locations.forEach((location, other) => {
        if (other !== index && location[key] !== undefined) {
          location[key] = false
        }
      })
    },
    setMarkerPosition (event, index) {
      const newCoords = event.marker.getLngLat()

      this.event.locations[index].position.lat = newCoords.lat
      this.event.locations[index].position.lng = newCoords.lng
    },
    // The name of an organising or cooperation body: from core's list, or the name the SU
    // stored for a body that core doesn't list any more.
    bodyName (body) {
      return body.body ? body.body.name : body.body_name
    },
    addOrganizingBody () {
      if (!this.selectedBody) {
        this.$root.showWarning('Please select a body.')
        return
      }

      if (this.event.organizing_bodies.some(body => body.body_id === this.selectedBody.id)) {
        this.$root.showWarning('This body is already presented in the organizing bodies list.')
        return
      }

      this.event.organizing_bodies.push({
        body: this.selectedBody,
        body_id: this.selectedBody.id
      })
      this.selectedBody = null
    },
    addCooperation () {
      if (!this.selectedCooperation) {
        this.$root.showWarning('Please select a body.')
        return
      }

      if (this.event.cooperation.some(body => body.body_id === this.selectedCooperation.id)) {
        this.$root.showWarning('This body is already presented in the cooperation list.')
        return
      }

      this.event.cooperation.push({
        body: this.selectedCooperation,
        body_id: this.selectedCooperation.id
      })
      this.selectedCooperation = null
    },
    saveEvent () {
      if (!this.event.starts) {
        return this.$root.showError('Please set the date when the event will start.')
      }

      if (!this.event.ends) {
        return this.$root.showError('Please set the date when the event will end.')
      }

      if (this.event.organizing_bodies.length === 0) {
        return this.$root.showError('Please select at least one organising body.')
      }

      if (this.event.organizers.length === 0) {
        return this.$root.showError('Please add at least one organiser.')
      }

      this.isSaving = true
      this.errors = {}

      // we don't need to pass body objects there
      const eventToSave = JSON.parse(JSON.stringify(this.event))
      eventToSave.organizing_bodies = eventToSave.organizing_bodies.map(body => ({ body_id: body.body_id }))
      eventToSave.organizers = eventToSave.organizers.map(org => ({ user_id: org.user_id, role: org.role }))
      if (this.event.cooperation.length !== 0) {
        eventToSave.cooperation = eventToSave.cooperation.map(body => ({ body_id: body.body_id }))
      }

      const promise = this.$route.params.id
        ? this.axios.put(this.services['summeruniversity'] + '/single/' + this.$route.params.id, eventToSave)
        : this.axios.post(this.services['summeruniversity'], eventToSave)

      promise.then((response) => {
        this.isSaving = false
        this.$root.showSuccess('Event is saved.')

        return this.$router.push({
          name: 'oms.summeruniversity.view',
          params: { id: response.data.data.url || response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        // Validation errors per field; other 422s only have a message.
        if (err.response && err.response.status === 422 && err.response.data.errors) {
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the event data is invalid.')
        }

        this.$root.showError('Could not save event', err)
      })
    },
    onMapLoaded (event) {
      this.map.actions = event.component.actions

      // waiting till the event is loaded.
      if (!this.isLoading && this.event.id) {
        this.centerMap()
      }
    },
    centerMap () {
      // we don't know, what'll happen first, the map will load or the event will load.
      // and we need both to be loaded.
      if (this.event.locations.length === 0) {
        return
      }

      // if it's a single point, then just centering on it
      if (this.event.locations.length === 1) {
        this.map.actions.jumpTo({
          center: this.event.locations[0].position,
          zoom: 10
        })
        return
      }

      const minCoords = {
        lat: Math.min(...this.event.locations.map(location => location.position.lat)),
        lng: Math.min(...this.event.locations.map(location => location.position.lng))
      }
      const maxCoords = {
        lat: Math.max(...this.event.locations.map(location => location.position.lat)),
        lng: Math.max(...this.event.locations.map(location => location.position.lng))
      }

      this.map.actions.fitBounds([minCoords, maxCoords], { padding: 50 })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  watch: {
    'event.name': function (newName) {
      if (!this.$route.params.id) {
        this.event.url = this.$root.sluggify(newName)
      }
    },
    // An emptied date picker gives null, which would be 1970 as a date.
    'dates.starts': function (newDate) {
      this.event.starts = newDate ? new Date(newDate) : null
    },
    'dates.ends': function (newDate) {
      this.event.ends = newDate ? new Date(newDate) : null
    }
  },
  mounted () {
    this.axios.get(this.services['summeruniversity'] + '/seasons').then((response) => {
      this.seasons = response.data.data
    }).catch((err) => this.$root.showError('Could not fetch seasons', err))

    this.axios.get(this.services['core'] + '/bodies/').then((response) => {
      this.bodies = response.data.data

      return this.axios.get(this.services['core'] + '/my_permissions/')
    }).then((response) => {
      this.can.editEventType = response.data.data.some(permission => permission.combined.endsWith('global:edit:su_type'))
      this.managedTypes = Object.keys(this.eventTypes).filter(type => response.data.data.some(permission => permission.combined.endsWith('global:manage_summeruniversity:' + type)))
      this.can.editFee = response.data.data.some(permission => permission.combined.endsWith('global:edit:su_fee'))

      if (!this.$route.params.id) {
        this.isLoading = false
        this.event.organizers.push({
          user_id: this.loginUser.id,
          first_name: this.loginUser.first_name,
          last_name: this.loginUser.last_name,
          disableEdit: true
        })
        return
      }

      return this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id).then((eventsResponse) => {
        this.event = eventsResponse.data.data
        this.can = eventsResponse.data.permissions
        this.can.editEventType = response.data.data.some(permission => permission.combined.endsWith('global:edit:su_type'))
        this.can.editFee = response.data.data.some(permission => permission.combined.endsWith('global:edit:su_fee'))

        this.dates.starts = this.event.starts = new Date(this.event.starts)
        this.dates.ends = this.event.ends = new Date(this.event.ends)

        for (const body of this.event.organizing_bodies) {
          const foundBody = this.bodies.find(b => b.id === body.body_id)
          this.$set(body, 'body', foundBody)
        }

        for (const body of this.event.cooperation) {
          const foundBody = this.bodies.find(b => b.id === body.body_id)
          this.$set(body, 'body', foundBody)
        }

        for (const organizer of this.event.organizers) {
          this.axios.get(this.services['core'] + '/members/' + organizer.user_id).then((organizerResponse) => {
            this.$set(organizer, 'first_name', organizerResponse.data.data.first_name)
            this.$set(organizer, 'last_name', organizerResponse.data.data.last_name)
          }).catch((err) => this.$root.showError('Could not fetch an organiser', err))

          if (this.loginUser.id === organizer.user_id) {
            this.$set(organizer, 'disableEdit', true)
          }
        }

        this.isLoading = false
      })
    }).catch((err) => {
      this.isLoading = false
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.summeruniversity.list.all' })
    })
  }
}
</script>
