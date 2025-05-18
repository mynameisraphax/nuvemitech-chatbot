document.addEventListener('DOMContentLoaded', () => {
       const logoutLink = document.querySelector('.logout a');
       if (logoutLink) {
           logoutLink.addEventListener('click', () => {
               alert('Você saiu do sistema!');
           });
       }

       const urlParams = new URLSearchParams(window.location.search);
       const error = urlParams.get('error');
       if (error) {
           const errorDiv = document.createElement('div');
           errorDiv.className = 'error';
           errorDiv.textContent = error;
           document.querySelector('.container').prepend(errorDiv);
       }
   });