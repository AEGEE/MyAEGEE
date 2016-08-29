(function ()
{
    'use strict';
    var baseUrl = baseUrlRepository['oms-events'];
    var apiURL = baseUrl + 'api/';


    angular
        .module('app.events', [])
        .config(config)
        .controller('ListingController', ListingController)
        .controller('SingleController', SingleController)
        .controller('NewController', NewController);

    /** @ngInject */
    function config($stateProvider)
    {
        // State
         $stateProvider
            .state('app.events', {
                url: '/listing',
                data: {'pageTitle': 'All Events'},
                views   : {
                    'pageContent@app': {
                        templateUrl: baseUrl + 'frontend/pages/listing.html',
                        controller: 'ListingController as vm'
                    }
                }
            })
			.state('app.events.single', {
            	url: '/single/:id',
            	views: {
            		'pageContent@app': {
            			templateUrl: baseUrl + 'frontend/pages/single.html',
            			controller: 'SingleController as vm'
            		}
            	}
            })
            .state('app.events.edit', {
            	url: '/edit/:id',
            	views: {
            		'pageContent@app': {
            			templateUrl: baseUrl + 'frontend/pages/new.html',
            			controller: 'NewController as vm'
            		}
            	}
            })
            .state('app.events.new', {
            	url: '/new',
            	views: {
            		'pageContent@app': {
            			templateUrl: baseUrl + 'frontend/pages/new.html',
            			controller: 'NewController as vm'
            		}
            	}
            })
            ;
    }

    function ListingController($scope, $http) {        
	
		// Fetch events from backend
		$http.get(apiURL).success(function(response) {
			$scope.events = response; 
		});
    }

    function SingleController($scope, $http, $stateParams) {

		$http.get(apiURL + 'single/' + $stateParams.id).success( function(response) {
			$scope.event = response; 
		});
	}



function NewController($scope, $http, $stateParams, $state) {

	// Enable DateTimepickers on the page
	angular.element(document).ready(function () {
		 $('#startsDateTimePicker').datetimepicker();
		 $('#endsDateTimePicker').datetimepicker();
		 $('#deadlineDateTimePicker').datetimepicker();
	});

	$scope.heading = "New Event";
	$scope.event = {};

	// If no route params are given, the user wants to create a new event -> Post
	$scope.submitForm = function() {
		$http.post(apiURL, $scope.event).then(function successCallback(response) {
			$state.go(single, {id: response.data._id});
			console.log(response);
		}, function errorCallback(response) {
			console.log(response);
		});
	}

	// Load data from server, if eventid specified
	// Also use another submit message
	if($stateParams.id) {
		var resourceURL = apiURL + '/single/' + $stateParams.id;
		$scope.heading = "Edit Event";

		// Edit the event with a put
		$scope.submitForm = function() {
			$http.put(resourceURL, $scope.event).then(function successCallback(response) {
				$state.go(single, {id: $stateParams.id});
			}, function errorCallback(response) {
				console.log(response);

			});
		}
		
		$http.get(resourceURL).success( function(response) {
	      	$scope.event = response;

	      	// Ugly fix as AngularJs datetime-local inputs require Date objects
	      	$scope.event.starts = new Date(response.starts);
	      	$scope.event.ends = new Date(response.ends);
	      	$scope.event.application_deadline = new Date(response.application_deadline);

	   	});
	}

}

})();

