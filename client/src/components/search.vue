<template>
  <div class="search">
    <input type="search" placeholder="Search YouTube or Paste URL" v-model="terms" @search="search" />
    <p style="color:red;" v-if="error">{{ error }}</p>

    <div class="search__results" v-if="results.length !== 0">
      <div class="search__results-scroll-container">
        <a class="search-result" v-for="(result, idx) in results" :key="idx" :href="result.url" target="_blank" @click.prevent="queueResult(result)">
          <img :src="result.thumbnail.url" :alt="result.title" :width="result.thumbnail.width" :height="result.thumbnail.height" class="search-result__thumbnail" />
          <h4 class="search-result__title">{{ result.title }}</h4>
        </a>
      </div>
    </div>
  </div>
</template>

<script>
  import Vue from 'vue';

  export default Vue.component('search', {
    data() {
      return {
        terms: '',
        results: [],
        error: null,
        key: 'AIzaSyAi4w58SdvfLfxjuznzWUNF8R-_wVNul6M',
        maxResults: 25,
      };
    },
    methods: {
      /**
       * Search
       */
      search() {
        this.error = null;

        // if the terms are empty, reset the results list
        if (this.terms.length === 0) {
          this.results = [];
          return;
        }

        // @Debugging
        if (process.env.mode === 'development' && this.terms === '/') {
          this.$root.$emit('debugQueueVideos');
          this.results = [];
          this.terms = '';
          return;
        }

        // was a youtube url pasted?
        if (this.terms.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/)) {
          this.$root.$emit('queue-video', this.terms);
          this.terms = '';
          return;
        }

        // search!
        fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${this.maxResults}&q=${this.terms}&key=${this.key}`)
          .then(res => res.json())
          .then((res) => {
            console.log(res);

            if (res.error) {
              this.error = res.error.message;
              this.results = [];
              return;
            }

            this.results = res.items.map((item) => {
              return {
                id: item.id.videoId,
                url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium,
              };
            });
          })
          .catch(err => console.error(err));
      },

      /**
       * Queue a search result which was clicked in the search results window
       */
      queueResult(result) {
        this.$root.$emit('queue-video', result.url);

        this.results = [];
        this.terms = '';
      },
    },
  });
</script>

<style lang="scss" scoped>
  .search {
    width: 100%;
    max-width: 500px;
    margin-left: 50px;

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
  }

  .search__results {
    position: absolute;
    top: calc(100% + 25px);
    left: 0;
    width: 100%;
    background-color: white;
    color: #000000;
    z-index: 100;
    padding: 10px 0;

    &::before {
      content: "";
      position: absolute;
      bottom: 100%;
      left: 470px;
      width: 0;
      height: 0;
      border: solid transparent;
      border-color: rgba(136, 183, 213, 0);
      border-bottom-color: #ffffff;
      border-width: 10px;
      pointer-events: none;
    }
  }

  .search__results-scroll-container {
    display: flex;
    flex-wrap: wrap;
    max-height: 80vh;
    overflow-y: scroll;
  }

  .search-result {
    padding: 0 10px;

    .search-result__thumbnail {
      line-height: 0;
    }

    .search-result__title {
      margin: 0;
    }
  }
</style>
