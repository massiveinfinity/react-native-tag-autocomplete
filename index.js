import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  StyleSheet,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
  ViewPropTypes as RNViewPropTypes,
  ActivityIndicator,
} from 'react-native';
import Autocomplete from 'react-native-autocomplete-input';

// In milliseconds
const DEBOUNCE_TIMER = 200;
const DEFAULT_MAX_SUGGESTIONS_COUNT = 5;
const TYPE_NO_RESULTS_FOUND = 'NO_RESULTS';
const TYPE_ERROR = 'ERROR';
const ViewPropTypes = RNViewPropTypes || View.propTypes;

class AutoTags extends Component {
  static propTypes = {
    /**
     * @deprecated
     * Array of suggestion objects. They must have a
     * 'name' prop if not overriding filter && renderTags
     */
    suggestions: PropTypes.array,
    /**
     * Assign an array of data objects which should be
     * rendered in respect to selected tags.
     */
    tagsSelected: PropTypes.array,
    /**
     * Handler for when suggestion is selected
     * (normally just push to tagsSelected)
     */
    handleAddition: PropTypes.func,
    /**
     * Handler called with index when tag is clicked
     */
    handleDelete: PropTypes.func,
    /**
     * Input placeholder
     */
    placeholder: PropTypes.string,
    /**
     * Set input placeholder text color
     */
    placeholderTextColor: PropTypes.string,
    /**
     * Override the render tags and its styles
     */
    renderTags: PropTypes.func,
    /**
     * Override the suggestions dropdown items
     */
    renderSuggestion: PropTypes.func,
    /**
     * @deprecated
     * Override the search function, allows you
     * to filter by props other than name
     */
    filterData: PropTypes.func,
    /**
     * Function called with user input when user presses enter
     */
    onCustomTagCreated: PropTypes.func,
    /**
     * calls `onCustomTagCreated` when user presses space
     */
    createTagOnSpace: PropTypes.bool,
    /**
     * Override the default tag styling
     */
    tagStyles: ViewPropTypes.style,
    /**
     * Move tags below the input instead of above (default)
     */
    tagsOrientedBelow: PropTypes.bool,
    /**
     * Function callback ((text, onSuccess, onError) => {})
     * when user has finish typing
     */
    onInputChangeText: PropTypes.func,
    /**
     * Override the default input text styling
     */
    inputStyle: ViewPropTypes.style,
    /**
     * @deprecated
     * Set other props on suggestion FlatList
     */
    flatListProps: PropTypes.object,
    /**
     * Override the default debounce timer
     * (Default at 200 milliseconds)
     */
    debounceTimer: PropTypes.number,
    /**
     * Render layout of inner tags.
     */
    renderInnerTags: PropTypes.func,
    /**
     * Max Suggestion count
     */
    maxSuggestionsCount: PropTypes.number,
    /**
     * Override the default suggestion list item style
     */
    suggestionListItemStyle: ViewPropTypes.style,
    /**
     * Set other props on suggestion FlatList
     */
    suggestionListProps: PropTypes.object,
    /**
     * Listener when suggestion list appears.
     * (height) => {}
     */
    onSuggestionListShow: PropTypes.func,
    /**
     * Listener when suggestion list hides.
     * () => {}
     */
    onSuggestionListHide: PropTypes.func,
    /**
     * Set empty results message
     */
    emptyResults: PropTypes.string,
  };

  state = {
    query: '',
    suggestions: [],
    noResultsFound: false,
    isError: false,
    errorMessage: null,
    autoCompleteWidth: 200,
    isLoading: false,
  };

  constructor(props) {
    super(props);
    this.timeout = 0;
  }

  getNoResultsPlaceholder = () => {
    return [{ __type: TYPE_NO_RESULTS_FOUND, name: 'No results found' }];
  };

  getErrorPlaceholder = () => {
    return [
      {
        __type: TYPE_ERROR,
      },
    ];
  };

  renderTags = () => {
    if (this.props.renderTags) {
      return this.props.renderTags(this.props.tagsSelected);
    }

    const tagMargins = this.props.tagsOrientedBelow
      ? { marginBottom: 5 }
      : { marginTop: 5 };

    return (
      <View
        style={[
          this.props.tagStyles || styles.tags,
          this.props.tagsSelected.length > 0 ? { marginBottom: 4 } : null,
        ]}
      >
        {this.props.tagsSelected.map((t, i) => {
          return (
            <TouchableHighlight
              key={i}
              style={[tagMargins, styles.tag]}
              onPress={() => this.props.handleDelete(i)}
            >
              {this.props.renderInnerTags ? (
                this.props.renderInnerTags({ item: t, index: i })
              ) : (
                <Text>{t.name}</Text>
              )}
            </TouchableHighlight>
          );
        })}
      </View>
    );
  };

  onChangeText = (text) => {
    this.setState({ query: text, suggestions: [] });
    if (text === null || text === undefined || text.length === 0) {
      this.removeLoading();
      this.clearSuggestions();
    } else {
      this.setLoading();
    }

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.handleInput(text);
    }, this.props.debounceTimer || DEBOUNCE_TIMER);
  };

  handleInput = (text) => {
    if (this.submitting) return;
    if (this.props.allowBackspace) {
      //TODO: on ios, delete last tag on backspace event && empty query
      //(impossible on android atm, no listeners for empty backspace)
    }
    if (this.props.onInputChangeText)
      return this.props.onInputChangeText(text, this.onSuccess, this.onError);
    if (
      this.props.createTagOnSpace &&
      this.props.onCustomTagCreated &&
      text.length > 1 &&
      text.charAt(text.length - 1) === ' '
    ) {
      this.setState({ query: '' });
      return this.props.onCustomTagCreated(text.trim());
    } else if (this.props.createTagOnSpace && !this.props.onCustomTagCreated) {
      console.error(
        'When enabling createTagOnSpace, you must provide an onCustomTagCreated function'
      );
    }

    if (text.charAt(text.length - 1) === '\n') {
      return; // prevent onSubmit bugs
    }

    this.setState({ query: text, noResultsFound: false, isError: false });
  };

  filterData = (query) => {
    if (!query || query.trim() == '' || !this.props.suggestions) {
      return;
    }
    if (this.props.filterData) {
      return this.props.filterData(query);
    }
    let suggestions = this.props.suggestions;
    let results = [];
    query = query.toUpperCase();
    suggestions.forEach((i) => {
      if (i.name.toUpperCase().includes(query)) {
        results.push(i);
      }
    });

    if (results.length === 0 && !this.state.noResultsFound) {
      this.setState({
        noResultsFound: true,
      });
    }

    return results;
  };

  onSubmitEditing = () => {
    const { query } = this.state;
    if (!this.props.onCustomTagCreated || query.trim() === '') return;
    this.setState({ query: '' }, () => this.props.onCustomTagCreated(query));

    // prevents an issue where handleInput() will overwrite
    // the query clear in some circumstances
    this.submitting = true;
    setTimeout(() => {
      this.submitting = false;
    }, 30);
  };

  addTag = (tag) => {
    this.clearSuggestions();
    if (this.state.noResultsFound) {
      return;
    }

    this.props.handleAddition(tag);
    this.setState({ query: '' });
  };

  onSuccess = (data) => {
    this.removeLoading();

    if (data.length > 0) {
      this.setState({
        suggestions: data.splice(
          0,
          this.props.maxSuggestionsCount || DEFAULT_MAX_SUGGESTIONS_COUNT
        ),
      });
    } else {
      this.setState({
        noResultsFound: true,
      });
    }
  };

  onError = (err) => {
    this.removeLoading();
    this.setState({
      isError: true,
      errorMessage: err,
    });
  };

  setLoading = () => {
    if (this.state.isLoading) {
      return;
    }

    this.setState({
      isLoading: true,
    });
  };

  removeLoading = () => {
    if (!this.state.isLoading) {
      return;
    }

    this.setState({
      isLoading: false,
    });
  };

  clearSuggestions = () => {
    if (this.props.onSuggestionListHide) {
      this.props.onSuggestionListHide();
    }

    this.setState({
      suggestions: [],
      noResultsFound: false,
      isError: false,
    });
  };

  getItemForRender = ({ item, index }) => {
    if (item.__type === TYPE_ERROR) {
      return (
        <Text style={this.props.suggestionListItemStyle} key={index}>
          {this.state.errorMessage}
        </Text>
      );
    } else if (item.__type === TYPE_NO_RESULTS_FOUND) {
      return (
        <Text style={this.props.suggestionListItemStyle} key={index}>
          {this.props.emptyResults || item.name}
        </Text>
      );
    } else if (this.props.renderSuggestion) {
      return this.props.renderSuggestion({ item, index });
    } else {
      return (
        <Text style={this.props.suggestionListItemStyle} key={index}>
          {item.name}
        </Text>
      );
    }
  };

  isRenderItemDisabled = () => {
    const { noResultsFound, isError } = this.state;
    return noResultsFound || isError;
  };

  render() {
    const {
      query,
      suggestions,
      noResultsFound,
      isError,
      errorMessage,
    } = this.state;

    //const data = this.filterData(query);
    let data = [];

    if (noResultsFound) {
      data = [...this.getNoResultsPlaceholder()];
    } else if (isError) {
      data = [...this.getErrorPlaceholder()];
    } else {
      data = suggestions;
    }

    return (
      <View
        style={styles.AutoTags}
        onLayout={(ev) => {
          this.setState({
            autoCompleteWidth: ev.nativeEvent.layout.width,
          });
        }}
      >
        {!this.props.tagsOrientedBelow &&
          this.props.tagsSelected &&
          this.renderTags()}
        <Autocomplete
          data={data}
          controlled={true}
          placeholder={this.props.placeholder}
          defaultValue={query}
          value={query}
          onChangeText={this.onChangeText}
          onSubmitEditing={this.onSubmitEditing}
          multiline={true}
          autoFocus={this.props.autoFocus === false ? false : true}
          renderItem={({ item, i }) => (
            <TouchableOpacity
              disabled={this.isRenderItemDisabled()}
              onPress={(e) => this.addTag(item)}
            >
              {this.getItemForRender({ item, index: i })}
            </TouchableOpacity>
          )}
          inputContainerStyle={[
            this.props.inputContainerStyle || styles.inputContainerStyle,
            this.props.tagsSelected.length > 0 ? { marginBottom: 8 } : null,
          ]}
          containerStyle={this.props.containerStyle || styles.containerStyle}
          underlineColorAndroid="transparent"
          listContainerStyle={{
            backgroundColor: 'white',
            width: this.state.autoCompleteWidth,
          }}
          listStyle={{
            backgroundColor: 'white',
            borderTopWidth: 1,
            top: this.props.tagsSelected.length > 0 ? 0 : 10,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 1,
            },
            shadowOpacity: 0.2,
            shadowRadius: 1.41,
            zIndex: 1000,
            elevation: 4,
          }}
          style={this.props.inputStyle}
          onBlur={() => {
            this.clearSuggestions();
          }}
          onFocus={(ev) => {
            const query = ev.nativeEvent.text;
            this.onChangeText(query);
          }}
          flatListProps={{
            onContentSizeChange: (newWidth, newHeight) => {
              if (this.props.onSuggestionListShow) {
                this.props.onSuggestionListShow(newHeight);
              }
            },
            ...this.props.suggestionListProps,
          }}
          {...this.props}
        />
        {this.props.tagsOrientedBelow &&
          this.props.tagsSelected &&
          this.renderTags()}
        {this.state.isLoading && (
          <View
            style={{
              position: 'absolute',
              bottom: this.props.tagsSelected.length > 0 ? 8 : 0,
              right: 0,
            }}
          >
            <ActivityIndicator />
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  AutoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    width: '100%',
  },
  tag: {
    backgroundColor: 'rgb(244, 244, 244)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    borderRadius: 30,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
  },
  inputContainerStyle: {
    borderRadius: 0,
    width: '100%',
    justifyContent: 'center',
    borderColor: 'transparent',
    alignItems: 'stretch',
  },
  containerStyle: {
    minWidth: 200,
  },
});

export default AutoTags;
