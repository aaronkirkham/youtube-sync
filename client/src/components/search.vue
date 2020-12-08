<template>
  <div v-click-outside="closeResults" class="search">
    <label :class="{ 'searching': searching }" class="search-label">
      <input v-model="terms" type="search" placeholder="Search YouTube or Paste URL" @focus="openResults" @keyup.enter="search">
      <svg class="spinner" width="20" height="20" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5" />
      </svg>
    </label>
    <div v-if="showResults" :class="{ 'is-searching': searching }" class="search__results">
      <p v-if="error" class="search-error">{{ error }}</p>
      <div v-else ref="container" class="search__results-scroll-container">
        <a v-for="(result, idx) in results" :key="idx" class="search-result" :href="result.url" target="_blank" @click.prevent="queueResult(result)">
          <img :src="result.thumbnail.url" :alt="result.title" :width="result.thumbnail.width" :height="result.thumbnail.height" class="search-result__thumbnail">
          <div class="search-result__content">
            <h4 class="search-result__title">{{ result.title }}</h4>
            <h5 class="search-result__channel">{{ result.channel }}</h5>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    data() {
      return {
        terms: '',
        showResults: false,
        results: [],
        resultsScroll: 0,
        searching: false,
        lastSearchTime: Date.now(),
        error: null,
        nextPageToken: null,
        decoder: null,
      };
    },
    watch: {
      // NOTE: we watch this because the user might press the clear button in the input[type=search]
      terms(value) {
        if (value.length === 0) {
          this.error = null;
          this.showResults = false;
          this.resultsScroll = 0;
          this.results = [];
        }
      },
    },
    methods: {
      /**
       * Event fired once the user clicks in the search box.
       * Now we show the latest stored results back to the user
       */
      openResults() {
        if (!this.showResults && this.results.length !== 0) {
          this.showResults = true;
          this.$nextTick(() => { this.$refs.container.scrollTop = this.resultsScroll; });
        }
      },

      /**
       * Event fired once the user clicks outside the search box.
       * Hide the search results panel
       */
      closeResults() {
        if (this.showResults) {
          if (!this.error) {
            this.resultsScroll = this.$refs.container.scrollTop;
          }

          this.showResults = false;
        }
      },

      /**
       * Event fired once the user hits enter in the search box.
       */
      search() {
        const now = Date.now();
        this.error = null;

        // limit spam searching
        if (this.searching || this.terms.length === 0 || (now - this.lastSearchTime) < 1000) {
          return;
        }

        // @Debugging
        if (process.env.MODE === 'development' && this.terms === '/') {
          this.$root.$emit('debugQueueVideos');
          this.showResults = false;
          this.results = [];
          this.terms = '';
          return;
        }

        // was a youtube or vimeo url pasted?
        if (this.terms.match(/^.*((youtu.be\/|vimeo.com\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/)) {
          this.$root.$emit('queue-video', this.terms);
          this.terms = '';
          return;
        }

        const handleApiResult = response => new Promise((resolve, reject) => {
          if (response.error) return reject(new Error(response.error.message));
          if (response.items.length === 0) return reject(new Error('No Results'));
          return resolve(response);
        });

        //
        this.searching = true;
        this.lastSearchTime = now;

        // search!
        fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${this.terms}&key=${process.env.APIKEY}`)
          .then(res => res.json())
          .then(res => handleApiResult(res))
          .then((res) => {
            this.results = res.items.map(item => ({
              id: item.id.videoId,
              url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
              title: this.decodeCharacters(item.snippet.title),
              thumbnail: item.snippet.thumbnails.medium,
              channel: item.snippet.channelTitle,
            }));

            this.searching = false;
            this.showResults = true;
            this.resultsScroll = 0;
            this.nextPageToken = res.nextPageToken;

            this.$nextTick(() => { this.$refs.container.scrollTop = 0; });
          })
          .catch((err) => {
            this.error = err.message;
            this.results = [];
            this.searching = false;
            this.showResults = true;
          });
      },

      /**
       * Decode encoded characters returned from the YouTube API
       */
      decodeCharacters(html) {
        if (!this.decoder) {
          this.decoder = document.createElement('div');
        }

        this.decoder.innerHTML = html;
        return this.decoder.textContent;
      },

      /**
       * Queue a search result which was clicked in the search results window
       */
      queueResult(result) {
        this.$root.$emit('queue-video', result);
        this.closeResults();
      },
    },
  };
</script>

<style lang="scss" scoped>
  @import '../mixins.scss';

  .search {
    position: relative;
    width: 100%;
    max-width: 500px;
  }

  .search-error {
    color: #de2925;
    padding: 0 5px;
    text-align: center;
    word-break: break-word;
  }

  .search-label {
    input {
      position: relative;
      width: 100%;
      padding: 15px 15px 15px 45px;
      border-radius: 2px;
      border: none;
      outline: none;
      background: {
        image: url('data:image/svg+xml;utf8,<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><path d="M19.427 21.427a8.5 8.5 0 1 1 2-2l5.585 5.585c.55.55.546 1.43 0 1.976l-.024.024a1.399 1.399 0 0 1-1.976 0l-5.585-5.585zM14.5 21a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z" fill="rgb(146, 146, 146)" fill-rule="evenodd"/></svg>');
        repeat: no-repeat;
        size: 28px;
        position: 10px calc(50% - 1px);
      };

      &:focus {
        box-shadow: 0 4px 5px rgba(0, 0, 0, 0.20),
                    inset 0 0 0 2px rgba(0, 123, 255, 0.5);
      }
    }

    .spinner {
      display: none;
      position: absolute;
      top: calc(50% - 10px);
      left: 15px;
      width: 20px;
      height: 20px;

      .path {
        stroke: #929292;
      }
    }

    &.searching {
      input {
        background-image: none;
      }

      .spinner {
        display: block;
      }
    }
  }

  .search__loading {
    position: absolute;
    top: 50%;
    left: 50%;
    line-height: 0;
    transform: translate(-50%, -50%);
    user-select: none;
    pointer-events: none;
  }

  .search__results {
    position: absolute;
    top: calc(100% + 17px);
    left: 0;
    width: 100%;
    min-height: 70px;
    padding: 10px 0;
    background-color: #ffffff;
    border-radius: 2px;
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.50);
    z-index: 100;

    &::before {
      content: "";
      position: absolute;
      bottom: 100%;
      right: calc(50% - 3px);
      width: 0;
      height: 0;
      border: solid transparent;
      border-color: rgba(136, 183, 213, 0);
      border-bottom-color: #ffffff;
      border-width: 7px;
      pointer-events: none;
    }

    &.is-searching {
      user-select: none;

      .search__results-scroll-container {
        overflow-y: hidden;
      }

      .search-result {
        pointer-events: none;
        opacity: 0.5;
      }
    }
  }

  .search__results-scroll-container {
    display: flex;
    flex-wrap: wrap;
    max-height: 80vh;
    overflow-y: scroll;
  }

  .search-result {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    padding: 5px 10px;
    text-decoration: none;
    @include transition(all);

    &:hover {
      background-color: #ebebeb;
    }

    &:first-child {
      padding-top: 0;
    }

    &:last-child {
      padding-bottom: 0;
    }
  }

  .search-result__thumbnail {
    max-width: 130px;
    height: auto;
    line-height: 0;
    border-radius: 2px;
  }

  .search-result__content {
    display: flex;
    flex-direction: column;
    margin-left: 15px;
    word-break: break-word;
  }

  .search-result__title {
    font-size: 16px;
    font-weight: 700;
    color: #282828;
    margin: 0;
  }

  .search-result__channel {
    font-size: 14px;
    font-weight: 400;
    color: #a0a0a0;
    margin: 3px 0 0 0;
  }
</style>
