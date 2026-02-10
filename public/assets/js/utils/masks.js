// public/assets/js/utils/masks.js
(function () {

    function maskCPF(value) {
      return value
        .replace(/\D/g, "")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
        .slice(0, 14);
    }
  
    function maskPhone(value) {
      return value
        .replace(/\D/g, "")
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2")
        .slice(0, 15);
    }
  
    // ⚠️ VALIDAÇÃO CPF (comentada para DEV)
    /*
    function validarCPF(cpf) {
      cpf = cpf.replace(/\D/g, "");
      if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  
      let soma = 0;
      for (let i = 0; i < 9; i++) soma += cpf[i] * (10 - i);
      let dig1 = (soma * 10) % 11;
      if (dig1 === 10) dig1 = 0;
      if (dig1 != cpf[9]) return false;
  
      soma = 0;
      for (let i = 0; i < 10; i++) soma += cpf[i] * (11 - i);
      let dig2 = (soma * 10) % 11;
      if (dig2 === 10) dig2 = 0;
      if (dig2 != cpf[10]) return false;
  
      return true;
    }
    */
  
    function applyMasks(container = document) {
      const cpfInputs = container.querySelectorAll('input[name="cpf"]');
      const phoneInputs = container.querySelectorAll('input[name="telefone"]');
  
      cpfInputs.forEach(input => {
        input.addEventListener("input", () => {
          input.value = maskCPF(input.value);
        });
      });
  
      phoneInputs.forEach(input => {
        input.addEventListener("input", () => {
          input.value = maskPhone(input.value);
        });
      });
    }
  
    window.applyMasks = applyMasks;
  
  })();
  